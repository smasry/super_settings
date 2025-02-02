# frozen_string_literal: true

unless ENV["SUPER_SETTINGS_NO_OVERRIDES"].present?
  SuperSettings.configure do |config|
    config.controller.application_name = "Test"
    config.controller.application_link = "/"
    config.controller.application_logo = "data:image/png;base64,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"

    config.refresh_interval = 2

    config.controller.superclass = "::ApplicationController"

    config.controller.enhance do
      # Request forgery protection is enabled by default for requests with cookies; it can be disabled with:
      # skip_before_action :verify_authenticity_token

      before_action do
        logger.debug("Overridden controller definition")
      end

      def current_user
        request.env["HTTP_AUTHORIZATION"]&.sub("Bearer ", "")
      end
    end

    config.controller.define_changed_by do
      current_user
    end

    config.controller.web_ui_javascript = "SuperSettingsAPI.headers['X-Authorization'] = 'User'"

    config.controller.authentication_url = "/login"

    config.model.cache = Rails.cache
    config.model.storage = ENV["SUPER_SETTINGS_STORAGE"]
    if config.model.storage.to_s == "redis"
      SuperSettings::Storage::RedisStorage.redis = Redis.new(url: ENV["SUPER_SETTINGS_REDIS_URL"])
    elsif config.model.storage.to_s == "http"
      SuperSettings::Storage::HttpStorage.redis = ENV["SUPER_SETTINGS_BASE_URL"]
    end
  end
end
