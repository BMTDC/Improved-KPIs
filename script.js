function initialize() {
    showMessage("Step 1: initializing extension");

    try {
        tableau.extensions.initializeAsync().then(function () {
            showMessage("Step 2: extension initialized");

            var worksheet = tableau.extensions.worksheetContent.worksheet;

            render(worksheet);

            worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, function () {
                render(worksheet);
            });
        }, function (err) {
            showMessage("Error while Initializing: " + escapeHtml(err.toString()));
        });
    } catch (err) {
        showMessage("Error before initializing: " + escapeHtml(err.toString()));
    }
}

async function render(worksheet) {
    try {
        showMessage("Step 3: reading encodings");

        var encodings = await getEncodings(worksheet);

        if (!encodings.date || !encodings.value) {
            showMessage("Drag a continuous date onto <strong>Date</strong> and a field onto <strong>Value</strong>.<br>Found encodings: " + escapeHtml(Object.keys(encodings).join(", ")));
            return;
        }

        showMessage("Step 4: reading summary data");

        var dataTable = await worksheet.getSummaryDataAsync({ ignoreSelection: true });

        showMessage("Step 5: processing " + dataTable.data.length + " rows");

        var dateIndex = findColumnIndex(dataTable.columns, encodings.date);
        var valueIndex = findColumnIndex(dataTable.columns, encodings.value);

        if (dateIndex === -1 || valueIndex === -1) {
            showMessage("Could not match the encoded fields to the worksheet data.<br>Encoded: " +
                escapeHtml(encodings.date.name) + ", " + escapeHtml(encodings.value.name) +
                "<br>Columns: " + escapeHtml(dataTable.columns.map(function (column) {
                    return column.fieldName;
                }).join(", ")));
            return;
        }

        var rows = dataTable.data
            .map(function (row) {
                return {
                    date: toDate(row[dateIndex].nativeValue),
                    dateLabel: row[dateIndex].formattedValue,
                    value: row[valueIndex].nativeValue,
                    valueLabel: row[valueIndex].formattedValue
                };
            })
            .filter(function (row) {
                return row.date !== null;
            });

        if (rows.length === 0) {
            showMessage("No data in the selected date range.");
            return;
        }

        var distinctDates = Array.from(new Set(rows.map(function (row) {
            return row.date.getTime();
        }))).sort(function (a, b) {
            return b - a;
        });

        var latestRows = rows.filter(function (row) {
            return row.date.getTime() === distinctDates[0];
        });

        var previousRows = distinctDates.length > 1
            ? rows.filter(function (row) {
                return row.date.getTime() === distinctDates[1];
            })
            : [];

        var latest = summarize(latestRows);
        var previous = previousRows.length > 0 ? summarize(previousRows) : null;

        drawKpi(encodings.value.name, latest, latestRows[0].dateLabel, previous);
    } catch (err) {
        showMessage("Error while rendering: " + escapeHtml(err.toString()));
    }
}

async function getEncodings(worksheet) {
    var spec = await worksheet.getVisualSpecificationAsync();
    var marks = spec.marksSpecifications[spec.activeMarksSpecificationIndex];
    var result = {};

    marks.encodings.forEach(function (encoding) {
        result[encoding.id] = encoding.field;
    });

    return result;
}

function findColumnIndex(columns, field) {
    var exact = columns.find(function (column) {
        return column.fieldName === field.name;
    });

    if (exact) {
        return exact.index;
    }

    var partial = columns.find(function (column) {
        return column.fieldName.indexOf(field.name) !== -1 || field.name.indexOf(column.fieldName) !== -1;
    });

    return partial ? partial.index : -1;
}

function toDate(value) {
    if (value === null || value === undefined) {
        return null;
    }

    var date = value instanceof Date ? value : new Date(value);

    return isNaN(date.getTime()) ? null : date;
}

function summarize(rows) {
    var numeric = rows.every(function (row) {
        return typeof row.value === "number";
    });

    if (numeric) {
        var total = rows.reduce(function (sum, row) {
            return sum + row.value;
        }, 0);

        return {
            isNumeric: true,
            raw: total,
            label: rows.length === 1 ? rows[0].valueLabel : formatNumber(total)
        };
    }

    var labels = Array.from(new Set(rows.map(function (row) {
        return row.valueLabel;
    })));

    return {
        isNumeric: false,
        raw: null,
        label: labels.join(", ")
    };
}

function formatNumber(value) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function drawKpi(title, latest, dateLabel, previous) {
    var deltaHtml = "";

    if (latest.isNumeric && previous && previous.isNumeric) {
        var diff = latest.raw - previous.raw;
        var pct = previous.raw !== 0 ? (diff / Math.abs(previous.raw)) * 100 : null;
        var cssClass = diff > 0 ? "up" : diff < 0 ? "down" : "";
        var arrow = diff > 0 ? "&#9650;" : diff < 0 ? "&#9660;" : "&#9632;";

        deltaHtml =
            "<div class='kpi-delta " + cssClass + "'>" +
            arrow + " " + formatNumber(diff) +
            (pct !== null ? " (" + pct.toFixed(1) + "%)" : "") +
            " vs previous" +
            "</div>";
    }

    document.getElementById("resultBox").innerHTML =
        "<div class='kpi-title'>" + escapeHtml(title) + "</div>" +
        "<div class='kpi-value'>" + escapeHtml(latest.label) + "</div>" +
        "<div class='kpi-date'>" + escapeHtml(dateLabel) + "</div>" +
        deltaHtml;
}

function showMessage(html) {
    document.getElementById("resultBox").innerHTML = "<div class='message' style='color:#666;'>" + html + "</div>";
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}