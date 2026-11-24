var DEFAULTS = {
    title: "",
    aggregation: "sum",
    decimals: "auto",
    prefix: "",
    suffix: "",
    defaultLevel: "0",
    showDelta: "true",
    higherIsBetter: "true",
    showSlider: "true",
    accentColor: "#1f4e79"
};

var CHECKBOXES = ["showDelta", "higherIsBetter", "showSlider"];

function initializeConfig() {
    tableau.extensions.initializeDialogAsync().then(function () {
        var saved = tableau.extensions.settings.getAll();
        var values = {};

        Object.keys(DEFAULTS).forEach(function (key) {
            values[key] = saved[key] !== undefined ? saved[key] : DEFAULTS[key];
        });

        fillForm(values);

        document.getElementById("settingsForm").addEventListener("submit", function (event) {
            event.preventDefault();
            save();
        });

        document.getElementById("resetBtn").addEventListener("click", function () {
            fillForm(DEFAULTS);
        });

        document.getElementById("cancelBtn").addEventListener("click", function () {
            tableau.extensions.ui.closeDialog("cancel");
        });
    }, function (err) {
        showError("Error while initializing: " + err.toString());
    });
}

function fillForm(values) {
    Object.keys(DEFAULTS).forEach(function (key) {
        var input = document.getElementById(key);

        if (CHECKBOXES.indexOf(key) !== -1) {
            input.checked = values[key] === "true";
        } else {
            input.value = values[key];
        }
    });
}

function save() {
    var settings = tableau.extensions.settings;

    Object.keys(DEFAULTS).forEach(function (key) {
        var input = document.getElementById(key);
        var value = CHECKBOXES.indexOf(key) !== -1 ? String(input.checked) : input.value;
        settings.set(key, value);
    });

    settings.saveAsync().then(function () {
        tableau.extensions.ui.closeDialog("saved");
    }).catch(function (err) {
        showError("Could not save settings: " + err.toString());
    });
}

function showError(message) {
    var box = document.getElementById("errorBox");
    box.textContent = message;
    box.classList.remove("hidden");
}