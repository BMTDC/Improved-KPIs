function initialize() {
    tableau.extensions.initializeAsync().then(function () {
        var worksheet = tableau.extensions.worksheetContent.worksheet;

        render(worksheet);

        worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, function () {
            render(worksheet);
        });
    }, function (err) {
        showMessage("Error while Initializing: " + escapeHtml(err.toString()));
    });
}

async function render(worksheet) {
    try {
        var encodings = await getEncodings(worksheet);

        if (!encodings.date || !encodings.value) {
            showMessage("Drag a continuous date onto <strong>Date</strong> and a field onto <strong>Value</strong>.");
            return;
        }

        var dataTable = await worksheet.getSummaryDataAsync({ ignoreSelection: true });

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
     