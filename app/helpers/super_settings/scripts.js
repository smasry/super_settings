(function() {
  function docReady(fn) {
    if (document.readyState === "complete" || document.readyState === "interactive") {
      setTimeout(fn, 1);
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  function addListener(element, event, handler) {
    if (element) {
      element.addEventListener(event, handler);
    }
  }

  function addListeners(elements, event, handler) {
    elements.forEach(function(element) { addListener(element, event, handler) });
  }

  function findSettingElement(id) {
    if (id) {
      return document.querySelector('#settings-table tr[data-id="' + id + '"]');
    } else {
      return null;
    }
  }

  function showError(error) {
    console.error('Error:', error)
    alert("Sorry, an error occurred. Refresh the page and try again.")
  }

  function changesCount() {
    let changes = 0;
    document.querySelectorAll("#settings-table tbody tr").forEach(function(element) {
      if (element.dataset.edited) {
        changes += 1;
      }
    });
    return changes;
  }

  function enableSaveButton() {
    const saveButton = document.querySelector("#save-settings");
    const discardButton = document.querySelector("#discard-changes");
    if (saveButton) {
      const count = changesCount();
      const countSpan = saveButton.querySelector(".count");
      if (count === 0) {
        saveButton.disabled = true;
        countSpan.innerHTML = "";
        discardButton.disabled = true;
      } else {
        saveButton.disabled = false;
        countSpan.innerHTML = count;
        discardButton.disabled = false;
      }
    }
  }

  function getFieldValueInput(settingRow) {
    const input = settingRow.querySelector(".super-settings-value input");
    if (!input) {
      input = settingRow.querySelector(".super-settings-value textarea");
    }
    return input;
  }

  function lastUsedAtAgeHTML(timestamp) {
    let colorClass = "text-danger";
    let message = null;
    let title = "";
    if (timestamp) {
      const lastUsedTime = Date.parse(timestamp)
      title = new Date(lastUsedTime).toUTCString().replace("GMT", "UTC");
      const hours = (Date.now() - lastUsedTime) / (3600 * 1000);
      if (hours < 1) {
        message = "less than one hour ago";
      } else if (hours < 2) {
        message = "over 1 hour ago";
      } else if (hours < 48) {
        message = `over ${hours} hours ago`;
      } else {
        message = `over ${Math.floor(hours / 24)} days ago`;
      }
    } else {
      message = "never used";
    }
    return `<div class="${colorClass}" title="${title}">${message}</div>`;
  }

  function setSettingDisplayValue(element, setting) {
    if (setting.value === null || setting.value === undefined) {
      element.innerText = "";
    } else if (Array.isArray(setting.value)) {
      let arrayHTML = "";
      setting.value.map(function(val) {
        arrayHTML += `<div>${escapeHTML(val)}</div>`;
      });
      element.innerHTML = arrayHTML;
    } else if (setting.value_type === "datetime") {
      try {
        const datetime = new Date(Date.parse(setting.value));
        element.innerText = datetime.toUTCString().replace("GMT", "UTC");
      } catch (e) {
        element.innerText = "" + setting.value
      }
    } else if (setting.value_type === "secret") {
      let placeholder = "••••••••••••••••••••••••";
      if (!setting.encrypted) {
        placeholder += '<br><span class="text-danger">not encrypted</span>'
      }
      element.innerHTML = placeholder;
    } else {
      element.innerText = "" + setting.value
    }
  }

  function getSettingEditValue(element) {
    if (element.querySelector("input[type=checkbox]")) {
      return element.querySelector("input[type=checkbox]").checked;
    } else {
      return element.querySelector(".js-setting-value").value;
    }
  }

  function changeSettingType(event) {
    event.preventDefault();
    const row = event.target.closest("tr");
    const valueType = event.target.options[event.target.selectedIndex].value;
    var setting = {
      id: row.dataset.id,
      key: row.querySelector(".super-settings-key input").value,
      value: getSettingEditValue(row),
      value_type: valueType,
      description: row.querySelector(".super-settings-description textarea").value,
      new_record: row.dataset.newrecord
    }
    const addedRow = addRowToTable(editSettingRow(setting));
    if (addedRow.querySelector(".super-settings-value .js-date-input")) {
      addedRow.querySelector(".super-settings-value .js-date-input").focus();
    } else {
      addedRow.querySelector(".super-settings-value .js-setting-value").focus();
    }
  }

  function changeDateTime(event) {
    const parentNode = event.target.closest("span")
    const dateValue = parentNode.querySelector(".js-date-input").value;
    let timeValue = parentNode.querySelector(".js-time-input").value;
    if (timeValue === "") {
      timeValue = "00:00:00";
    }
    parentNode.querySelector(".js-setting-value").value = `${dateValue}T${timeValue}Z`
  }

  function escapeHTML(text) {
    if (text === null && text === undefined) {
      return "";
    }
    const htmlEscapes = {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '/': '&#x2F;'};
    const htmlEscaper = /[&<>"'\/]/g;
    return ('' + text).replace(htmlEscaper, function(match) {
      return htmlEscapes[match];
    });
  }

  function mustacheSubstitute(html, setting) {
    return html.replaceAll("{{id}}", escapeHTML(setting.id));
  }

  function elementFromSettingTemplate(setting, templateSelector) {
    let html = document.querySelector(templateSelector).innerHTML;
    html = mustacheSubstitute(html, setting);
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function settingRow(setting) {
    const row = elementFromSettingTemplate(setting, "#setting-row-template");
    row.dataset.id = setting.id
    row.dataset.key = setting.key
    row.querySelector(".js-setting-key").value = setting.key;
    if (setting.deleted) {
      row.dataset.edited = true
      row.dataset.deleted = true
      row.querySelector(".js-setting-deleted").value = "1";
    }
    if (setting.key !== null && setting.key !== undefined) {
      row.querySelector(".super-settings-key .js-value-placeholder").innerText = setting.key;
    }
    if (setting.value !== null && setting.value !== undefined) {
      setSettingDisplayValue(row.querySelector(".super-settings-value .js-value-placeholder"), setting);
    }
    if (setting.value_type !== null && setting.value_type !== undefined) {
      row.querySelector(".super-settings-value-type .js-value-placeholder").innerText = setting.value_type;
    }
    if (setting.description !== null && setting.description !== undefined) {
      row.querySelector(".super-settings-description .js-value-placeholder").innerHTML = escapeHTML(setting.description).replaceAll("\n", "<br>");
    }

    if (setting.last_used_at !== undefined) {
      row.querySelector(".js-last_used_at-placeholder").innerHTML = lastUsedAtAgeHTML(setting.last_used_at);
    }

    return row
  }

  function createValueInputElement(setting) {
    let templateName = null;
    if (setting.value_type === "integer") {
      templateName = "#setting-value-field-integer-template";
    } else if (setting.value_type === "float") {
      templateName = "#setting-value-field-float-template";
    } else if (setting.value_type === "datetime") {
      templateName = "#setting-value-field-datetime-template";
    } else if (setting.value_type === "boolean") {
      templateName = "#setting-value-field-boolean-template";
    } else if (setting.value_type === "array") {
      templateName = "#setting-value-field-array-template";
    } else {
      templateName = "#setting-value-field-template";
    }
    const html = mustacheSubstitute(document.querySelector(templateName).innerHTML, setting);
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
  }

  function padTimeVal(val) {
    return ("" + val).padStart(2, "0");
  }

  function valueInputElement(setting) {
    const element = createValueInputElement(setting)
    if (setting.value_type === "boolean") {
      const checked = (`${setting.value}` === "true" || parseInt(setting.value) > 0)
      element.querySelector('input[type="checkbox"]').checked = checked;
    } else if (setting.value_type === "array") {
      if (Array.isArray(setting.value)) {
        element.value = setting.value.join("\n");
      } else {
        element.value = setting.value;
      }
    } else if (setting.value_type === "datetime") {
      const datetime = new Date(Date.parse(setting.value));
      const isoDate = `${datetime.getUTCFullYear()}-${padTimeVal(datetime.getUTCMonth() + 1)}-${padTimeVal(datetime.getUTCDate())}`;
      const isoTime = `${padTimeVal(datetime.getUTCHours())}:${padTimeVal(datetime.getUTCMinutes())}:${padTimeVal(datetime.getUTCSeconds())}`;
      element.querySelector('input[type="date"]').value = isoDate;
      element.querySelector('input[type="time"]').value = isoTime;
      element.querySelector(".js-setting-value").value = setting.value;
    } else {
      element.value = setting.value;
    }

    return element;
  }

  function editSettingRow(setting) {
    const row = elementFromSettingTemplate(setting, "#setting-row-edit-template");
    row.dataset.id = setting.id
    disableSubmitFormWithReturnKey(row);

    row.querySelector(".super-settings-key input").value = setting.key;

    const valueInput = valueInputElement(setting);
    const valuePlaceholder = row.querySelector(".super-settings-value .js-value-placeholder");
    valuePlaceholder.innerHTML = "";
    valuePlaceholder.appendChild(valueInput);

    const valueType = row.querySelector(".super-settings-value-type select");
    for (let i = 0; i < valueType.options.length; i++) {
      if (valueType.options[i].value === setting.value_type) {
        valueType.selectedIndex = i;
        break;
      }
    }

    if (setting.errors && setting.errors.length > 0) {
      let errorsHTML = "";
      setting.errors.forEach(function(error) {
        errorsHTML += `<div>${escapeHTML(error)}</div>`
      });
      row.querySelector(".js-setting-errors").innerHTML = errorsHTML;
    }

    if (setting.new_record) {
      row.dataset.newrecord = "true";
    }

    return row
  }

  function newSettingRow() {
    const randomId = "new" + Math.floor((Math.random() * 0xFFFFFFFFFFFFFF)).toString(16);
    const setting = {id: randomId, key: "", value: "", value_type: "string", new_record: true}
    row = editSettingRow(setting);
    return row;
  }

  function addRowToTable(row) {
    const existingRow = findSettingElement(row.dataset.id);
    if (existingRow) {
      existingRow.replaceWith(row);
    } else {
      document.querySelector("#settings-table tbody").prepend(row);
    }
    bindSettingControlEvents(row);
    filterSettings(document.querySelector("#filter").value);
    row.scrollIntoView({block: "nearest"});
    enableSaveButton();
    return row;
  }

  function renderSettingsTable(settings, changes) {
    const tbody = document.querySelector("#settings-table tbody");
    settings.forEach(function(setting) {
      const row = settingRow(setting);
      tbody.appendChild(row);
      bindSettingControlEvents(row);
    });
    if (changes) {
      changes.forEach(function(setting) {
        addRowToTable(editSettingRow(setting));
      });
    }
  }

  function apiURL(action, id) {
    let url = document.location.pathname;
    if (url.endsWith("/")) {
      url = url.substring(0, url.length - 1);
    }
    if (id) {
      url += "/" + id;
    }
    if (action) {
      url += "/" + action;
    }
    return url;
  }

  function addSetting(event) {
    event.preventDefault();
    const row = addRowToTable(newSettingRow());
    row.querySelector(".super-settings-key input").focus();
  }

  function editSetting(event) {
    event.preventDefault();
    const id = event.target.closest("tr").dataset.id;
    const setting = findSetting(id);
    const row = addRowToTable(editSettingRow(setting));
    if (row.querySelector(".super-settings-value .js-date-input")) {
      row.querySelector(".super-settings-value .js-date-input").focus();
    } else {
      row.querySelector(".super-settings-value .js-setting-value").focus();
    }
  }

  function restoreSetting(event) {
    event.preventDefault();
    const row = event.target.closest("tr");
    const id = row.dataset.id;
    const setting = findSetting(id);
    if (setting) {
      const newRow = settingRow(setting);
      bindSettingControlEvents(newRow);
      row.replaceWith(newRow);
    } else {
      row.remove();
    }
  }

  function removeSetting(event) {
    event.preventDefault();
    const settingRow = event.target.closest("tr");
    if (settingRow.dataset["id"]) {
      settingRow.querySelector("input.js-setting-deleted").value = "1";
      settingRow.dataset.edited = true;
      settingRow.dataset.deleted = true;
      settingRow.querySelector(".js-remove-setting").style.display = "none";
      settingRow.querySelector(".js-restore-setting").style.display = "inline-block";
    } else {
      settingRow.remove();
    }
    enableSaveButton();
  }

  function filterListener(event) {
    const filter = event.target.value;
    filterSettings(filter);
    updateFilterURL(filter);
  }

  function updateFilterURL(filter) {
    const queryParams = new URLSearchParams(window.location.search);
    if (filter === "") {
      queryParams.delete("filter");
    } else {
      queryParams.set("filter", filter);
    }
    if (queryParams.toString() !== "") {
      history.replaceState(null, null, "?" + queryParams.toString());
    } else {
      history.replaceState(null, null, window.location.pathname);
    }
  }

  function filterSettings(filterText) {
    const filters = [];
    filterText.split(" ").forEach(function(filter) {
      filter = filter.toUpperCase();
      filters.push(function(tr) {
        let text = "";
        const settingKey = tr.querySelector(".super-settings-key");
        if (settingKey) {
          text += " " + settingKey.textContent.toUpperCase();
        }
        const settingValue = tr.querySelector(".super-settings-value");
        if (settingValue) {
          text += " " + settingValue.textContent.toUpperCase();
        }
        const settingDescription = tr.querySelector(".setting-description");
        if (settingDescription) {
          text += " " + settingDescription.textContent.toUpperCase();
        }
        return (text.indexOf(filter) > -1);
      });
    });

    document.querySelectorAll("#settings-table tbody tr").forEach(function(tr) {
      let matched = true;
      if (!tr.dataset.edited) {
        filters.forEach(function(filter) {
          matched = matched && filter(tr);
        });
      }
      if (matched) {
        tr.style.display = "table-row";
      } else {
        tr.style.display = "none";
      }
    });
  }

  function dismissFlash() {
    if (document.querySelector(".js-flash")) {
      setTimeout(function(){
        document.querySelectorAll(".js-flash").forEach(function(element) {
          element.style.display = "none";
        });
      }, 3000);
    }
  }

  function applyFilter() {
    const filter = document.querySelector("#filter");
    if (filter) {
      filter.dispatchEvent(new Event("input"));
    }
  }

  function promptUnsavedChanges(event) {
    const form = document.querySelector("#settings-form");
    if (form && !form.dataset.submitting && changesCount() > 0) {
      return "Are you sure you want to leave?";
    } else {
      return undefined;
    }
  }

  function disableLeavePage(event) {
    document.querySelector("#settings-form").dataset.submitting = true;
  }

  function disableSubmitFormWithReturnKey(parent) {
    const inputs = parent.querySelectorAll("input[type=text], input[type=number], input[type=datetime-local], select");
    if (!inputs) {
      return;
    }
    inputs.forEach(function(element) {
      element.addEventListener("keypress", function(event) {
        if (event.keyCode === 13) {
          event.preventDefault();
        }
      });
    });
  }

  function refreshPage(event) {
    event.preventDefault();
    let url = window.location.href.replace(/\?.*/, "");
    const filter = document.querySelector("#filter").value;
    if (filter !== "") {
      url += "?filter=" + escape(filter);
    }
    window.location = url;
  }

  function renderHistoryTable(parent, payload) {
    parent.innerHTML = document.querySelector("#setting-history-table").innerHTML.trim();
    const tbody = parent.querySelector("tbody");
    let rowsHTML = "";
    payload.histories.forEach(function(history) {
      const date = (new Date(Date.parse(history.created_at))).toUTCString().replace("GMT", "UTC");
      rowsHTML += `<tr><td class="super-settings-text-nowrap">${escapeHTML(date)}</td><td>${escapeHTML(history.changed_by)}</td><td>${escapeHTML(history.value)}</td></tr>`;
    });
    tbody.insertAdjacentHTML("beforeend", rowsHTML);

    if (payload.previous_page_url || payload.next_page_url) {
      let paginationHTML = `<div class="align-center">`;
      if (payload.previous_page_url) {
        paginationHTML += `<div style="float:left;"><a href="${escapeHTML(payload.previous_page_url)}" class="js-show-history")>&#8592; Newer</a></div>`;
      }
      if (payload.next_page_url) {
        paginationHTML += `<div style="float:right;"><a href="${escapeHTML(payload.next_page_url)}" class="js-show-history")>Older &#8594;</a></div>`;
      }
      paginationHTML += '<div style="clear:both;"></div>';
      parent.querySelector("table").insertAdjacentHTML("afterend", paginationHTML);
    }
    addListeners(parent.querySelectorAll(".js-show-history"), "click", showHistoryModal);
  }

  function showModal() {
    const modal = document.querySelector("#modal");
    const content = document.querySelector(".super-settings-modal-content");
    modal.style.display = "block";
    modal.setAttribute("aria-hidden", "false");
    modal.activator = document.activeElement;
    focusableElements(document).forEach(function(element) {
      if (!modal.contains(element)) {
        element.dataset.saveTabIndex = element.getAttribute("tabindex");
        element.setAttribute("tabindex", -1);
      }
    });
    document.querySelector("body").style.overflow = "hidden";
  }

  function showHistoryModal(event) {
    event.preventDefault();
    const modal = document.querySelector("#modal");
    const content = document.querySelector(".super-settings-modal-content");
    let url = "";
    if (event.target.href) {
      url = event.target.href
    } else {
      const id = event.target.closest("tr").dataset.id;
      url = apiURL("history", id)
    }
    fetch(url, {credentials: "same-origin", headers: new Headers({"Accept": "application/json"})})
    .then(
      function(response) {
        if (response.ok) {
          return response.json();
        } else {
          throw( response.status + response.statusText)
        }
      }
    ).then(
      function(json) {
        renderHistoryTable(content, json);
        showModal();
      }
    ).catch(
      function(error) {
        showError(error);
      }
    );
  }

  function closeModal(event) {
    if (event.target.classList.contains("js-close-modal")) {
      event.preventDefault();
      const modal = document.querySelector("#modal");
      const content = document.querySelector(".super-settings-modal-content");
      modal.style.display = "none";
      modal.setAttribute("aria-hidden", "true");
      focusableElements(document).forEach(function(element) {
        const tabIndex = element.dataset.saveTabIndex;
        delete element.dataset.saveTabIndex;
        if (tabIndex) {
          element.setAttribute("tabindex", tabIndex);
        }
      });
      if (modal.activator) {
        modal.activator.focus();
        delete modal.activator;
      }
      content.innerHTML = "";
      document.querySelector("body").style.overflow = "visible";
    }
  }

  function focusableElements(parent) {
    return parent.querySelectorAll("a[href], area[href], button, input:not([type=hidden]), select, textarea, iframe, [tabindex], [contentEditable=true]")
  }

  function noOp(event) {
    event.preventDefault();
  }

  function findSetting(id) {
    let found = null;
    id = "" + id;
    SuperSettings.settings.forEach(function(setting) {
      if ("" + setting.id === id) {
        found = setting;
        return;
      }
    });
    return found;
  }

  function bindSettingControlEvents(parent) {
    addListeners(parent.querySelectorAll(".js-remove-setting"), "click", removeSetting);
    addListeners(parent.querySelectorAll(".js-edit-setting"), "click", editSetting);
    addListeners(parent.querySelectorAll(".js-restore-setting"), "click", restoreSetting);
    addListeners(parent.querySelectorAll(".js-show-history"), "click", showHistoryModal);
    addListeners(parent.querySelectorAll(".js-no-op"), "click", noOp);
    addListeners(parent.querySelectorAll(".js-setting-value-type"), "change", changeSettingType);
    addListeners(parent.querySelectorAll(".js-date-input"), "change", changeDateTime);
    addListeners(parent.querySelectorAll(".js-time-input"), "change", changeDateTime);
  }

  docReady(function() {
    addListener(document.querySelector("#filter"), "input", filterListener);
    addListener(document.querySelector("#add-setting"), "click", addSetting);
    addListener(document.querySelector("#discard-changes"), "click", refreshPage);
    addListener(document.querySelector("#settings-form"), "submit", disableLeavePage);
    addListener(document.querySelector("#modal"), "click", closeModal);

    renderSettingsTable(SuperSettings.settings, SuperSettings.changes);
    disableSubmitFormWithReturnKey(document.querySelector("#settings-table"))

    applyFilter();
    dismissFlash();
    enableSaveButton();
    window.onbeforeunload = promptUnsavedChanges;
  })
})();
