# frozen_string_literal: true

require_relative "super_settings/application"
require_relative "super_settings/coerce"
require_relative "super_settings/configuration"
require_relative "super_settings/context"
require_relative "super_settings/context/rack_middleware"
require_relative "super_settings/local_cache"
require_relative "super_settings/rest_api"
require_relative "super_settings/rack_application"
require_relative "super_settings/controller_actions"
require_relative "super_settings/attributes"
require_relative "super_settings/setting"
require_relative "super_settings/history_item"
require_relative "super_settings/storage"
require_relative "super_settings/version"

if defined?(Rails::Engine)
  require_relative "super_settings/engine"
end

# This is the main interface to the access settings.
module SuperSettings
  DEFAULT_REFRESH_INTERVAL = 5.0

  class << self
    # Get a setting value cast to a string.
    #
    # @param key [String, Symbol]
    # @param default [String] value to return if the setting value is nil
    # @return [String]
    def get(key, default = nil)
      val = context_setting(key)
      val.nil? ? default : val.to_s
    end

    # Alias for {#get} to allow using the [] operator to get a setting value.
    #
    # @param key [String, Symbol]
    # @return [String]
    def [](key)
      get(key)
    end

    # Get a setting value cast to an integer.
    #
    # @param key [String, Symbol]
    # @param default [Integer] value to return if the setting value is nil
    # @return [Integer]
    def integer(key, default = nil)
      val = context_setting(key)
      (val.nil? ? default : val)&.to_i
    end

    # Get a setting value cast to a float.
    #
    # @param key [String, Symbol]
    # @param default [Numeric] value to return if the setting value is nil
    # @return [Float]
    def float(key, default = nil)
      val = context_setting(key)
      (val.nil? ? default : val)&.to_f
    end

    # Get a setting value cast to a boolean.
    #
    # @param key [String, Symbol]
    # @param default [Boolean] value to return if the setting value is nil
    # @return [Boolean]
    def enabled?(key, default = false)
      val = context_setting(key)
      Coerce.boolean(val.nil? ? default : val)
    end

    # Return true if a setting cast as a boolean evaluates to false.
    #
    # @param key [String, Symbol]
    # @param default [Boolean] value to return if the setting value is nil
    # @return [Boolean]
    def disabled?(key, default = true)
      !enabled?(key, !default)
    end

    # Get a setting value cast to a Time.
    #
    # @param key [String, Symbol]
    # @param default [Time] value to return if the setting value is nil
    # @return [Time]
    def datetime(key, default = nil)
      val = context_setting(key)
      Coerce.time(val.nil? ? default : val)
    end

    # Get a setting value cast to an array of strings.
    #
    # @param key [String, Symbol]
    # @param default [Array] value to return if the setting value is nil
    # @return [Array]
    def array(key, default = nil)
      val = context_setting(key)
      val = default if val.nil?
      return nil if val.nil?
      Array(val).collect { |v| v&.to_s }
    end

    # Create settings and update the local cache with the values. If a block is given, then the
    # value will be reverted at the end of the block. This method can be used in tests when you
    # need to inject a specific value into your settings.
    #
    # @param key [String, Symbol] the key to set
    # @param value [Object] the value to set
    # @param value_type [String, Symbol] the value type to set; if the setting does not already exist,
    #   this will be inferred from the value.
    # @return [void]
    def set(key, value, value_type: nil)
      setting = Setting.find_by_key(key)
      if setting
        setting.value_type = value_type if value_type
      else
        setting = Setting.new(key: key)
        setting.value_type = (value_type || Setting.value_type(value) || Setting::STRING)
      end
      previous_value = setting.value
      setting.value = value
      begin
        setting.save!
        local_cache.load_settings unless local_cache.loaded?
        local_cache.update_setting(setting)

        if block_given?
          yield
        end
      ensure
        if block_given?
          setting.value = previous_value
          setting.save!
          local_cache.load_settings unless local_cache.loaded?
          local_cache.update_setting(setting)
        end
      end
    end

    # Define a block where settings will remain unchanged. This is useful to
    # prevent settings from changing while you are in the middle of a block of
    # code that depends on the settings.
    def context(&block)
      reset_context = Thread.current[:super_settings_context].nil?
      begin
        Thread.current[:super_settings_context] ||= {}
        yield
      ensure
        Thread.current[:super_settings_context] = nil if reset_context
      end
    end

    # Load the settings from the database into the in memory cache.
    #
    # @return [void]
    def load_settings
      local_cache.load_settings
      local_cache.wait_for_load
      nil
    end

    # Force refresh the settings in the in memory cache to be in sync with the database.
    #
    # @return [void]
    def refresh_settings
      local_cache.refresh
      nil
    end

    # Reset the in memory cache. The cache will be automatically reloaded the next time
    # you access a setting.
    #
    # @return [void]
    def clear_cache
      local_cache.reset
      nil
    end

    # Return true if the in memory cache has been loaded from the database.
    #
    # @return [Boolean]
    def loaded?
      local_cache.loaded?
    end

    # Configure various aspects of the gem. The block will be yielded to with a configuration
    # object. You should use this method to configure the gem from an Rails initializer since
    # it will handle ensuring all the appropriate frameworks are loaded first.
    #
    # @yieldparam config [SuperSettings::Configuration]
    # @return [void]
    def configure(&block)
      Configuration.instance.defer(&block)
      unless defined?(Rails::Engine)
        Configuration.instance.call
      end
    end

    # Set the number of seconds between checks to synchronize the in memory cache from the database.
    # This setting aids in performance since it throttles the number of times the database is queried
    # for changes. However, changes made to the settings in the databae will take up to the number of
    # seconds in the refresh interval to be updated in the cache.
    #
    # @return [void]
    def refresh_interval=(value)
      local_cache.refresh_interval = value
    end

    # URL for authenticating access to the application. This would normally be some kind of
    # login page. Browsers will be redirected here if they are denied access to the web UI.
    attr_accessor :authentication_url

    # Javascript to inject into the settings application HTML page. This can be used, for example,
    # to set authorization credentials stored client side to access the settings API.
    attr_accessor :web_ui_javascript

    private

    def local_cache
      @local_cache ||= LocalCache.new(refresh_interval: DEFAULT_REFRESH_INTERVAL)
    end

    def current_context
      Thread.current[:super_settings_context]
    end

    def context_setting(key)
      key = key.to_s
      context = current_context
      if context
        unless context.include?(key)
          context[key] = local_cache[key]
        end
        context[key]
      else
        local_cache[key]
      end
    end
  end
end
