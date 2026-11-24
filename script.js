var LEVELS = ["Latest", "Year", "Month", "Week", "Day"];

var CLS = {
    content: "m-auto w-full",
    latestWrap: "flex flex-col items-center gap-1",
    title: "text-sm font-medium uppercase tracking-wide text-gray-500",
    groupTitle: "mb-2 text-sm font-medium uppercase tracking-wide text-gray-500",
    value: "text-5xl font-bold leading-tight text-gray-800",
    date: "text-sm text-gray-400",
    delta: "mt-1 text-sm font-semibold",
    grid: "grid w-full grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-2",
    card: "flex flex-col items-center rounded-lg border border-gray-200 bg-gray-50 px-2 py-2",
    cardLabel: "text-xs font-medium uppercase tracking-wide text-gray-500",
    cardValue: "text-2xl font-bold text-gray-800",
    cardDelta: "text-xs font-semibold",
    message: "px-4 text-sm text-gray-400",
    up: "text-green-700",
    down: "text-red-700",
    flat: "text-gray-500"
};

var state = {
    title: "",
    rows: [],
    days: [],
    fromIdx: 0,
    toIdx: 0,
    level: 0
};

function initialize() {
    tableau.extensions.initializeAsync().then(function () {
        var worksheet = tableau.extensions.worksheetContent.worksheet;

        setupControls();
        loadData(worksheet);

        worksheet.addEventListener(tableau.TableauEventType.SummaryDataChanged, function () {
            loadData(worksheet);
        });
    }, function (err) {
        showMessage("Error while Initializing: " + escapeHtml(err.toString()));
    });
}

function setupControls() {
    el("fromSlider").addEventListener("input", function () {
        var value = parseInt(this.value, 10);
        if (value > state.toIdx) {
            state.toIdx = value;
            el("toSlider").value = value;
        }
        state.fromIdx = value;
        draw();
    });

    el("toSlider").addEventListener("input", function () {
        var value = parseInt(this.value, 10);
        if (value < state.fromIdx) {
            state.fromIdx = value;
            el("fromSlider").value = value;
        }
        state.toIdx = value;
        draw();
    });

    el("expandBtn").addEventListener("click", function () {
        var levels = getLevels();
        var pos = levels.indexOf(state.level);
        if (pos < levels.length - 1) {
            state.level = levels[pos + 1];
            draw();
        }
    });

    el("collapseBtn").addEventListener("click", function () {
        var levels = getLevels();
        var pos = levels.indexOf(state.level);
        if (pos > 0) {
            state.level = levels[pos - 1];
            draw();
        }
    });
}

function getLevels() {
    var years = new Set(state.days.map(function (day) {
        return new Date(day).getUTCFullYear();
    }));

    return years.size > 1 ? [0, 1, 2, 3, 4] : [0, 2, 3, 4];
}

function ensureValidLevel() {
    var levels = getLevels();

    if (levels.indexOf(state.level) === -1) {
        var next = levels.find(function (level) {
            return level > state.level;
        });
        state.level = next !== undefined ? next : levels[levels.length - 1];
    }

    return levels;
}

async function loadData(worksheet) {
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
                    day: toDay(row[dateIndex].nativeValue),
                    value: row[valueIndex].nativeValue,
                    valueLabel: row[valueIndex].formattedValue
                };
            })
            .filter(function (row) {
                return row.day !== null;
            });

        if (rows.length === 0) {
            showMessage("No data in the selected date range.");
            return;
        }

        var days = Array.from(new Set(rows.map(function (row) {
            return row.day;
        }))).sort(function (a, b) {
            return a - b;
        });

        applySelection(days);

        state.title = encodings.value.name;
        state.rows = rows;
        state.days = days;

        var slidersMax = days.length - 1;
        el("fromSlider").max = slidersMax;
        el("toSlider").max = slidersMax;
        el("fromSlider").value = state.fromIdx;
        el("toSlider").value = state.toIdx;

        draw();
    } catch (err) {
        showMessage("Error while rendering: " + escapeHtml(err.toString()));
    }
}

function applySelection(newDays) {
    var oldDays = state.days;
    var hadSelection = oldDays.length > 0 && !(state.fromIdx === 0 && state.toIdx === oldDays.length - 1);
    var lastIdx = newDays.length - 1;

    if (!hadSelection) {
        state.fromIdx = 0;
        state.toIdx = lastIdx;
        return;
    }

    var prevFrom = oldDays[state.fromIdx];
    var prevTo = oldDays[state.toIdx];

    var fromIdx = newDays.findIndex(function (day) {
        return day >= prevFrom;
    });

    var toIdx = -1;
    for (var i = lastIdx; i >= 0; i--) {
        if (newDays[i] <= prevTo) {
            toIdx = i;
            break;
        }
    }

    if (fromIdx === -1 || toIdx === -1 || fromIdx > toIdx) {
        state.fromIdx = 0;
        state.toIdx = lastIdx;
    } else {
        state.fromIdx = fromIdx;
        state.toIdx = toIdx;
    }
}

function draw() {
    var levels = ensureValidLevel();
    var from = state.days[state.fromIdx];
    var to = state.days[state.toIdx];

    var rows = state.rows.filter(function (row) {
        return row.day >= from && row.day <= to;
    });

    updateControls(from, to, levels);

    if (state.level === 0) {
        drawLatest(rows);
    } else {
        drawGroups(rows, state.level);
    }
}

function setControlsVisible(visible) {
    el("controls").classList.toggle("hidden", !visible);
    el("controls").classList.toggle("flex", visible);
}

function updateControls(from, to, levels) {
    var lastIdx = state.days.length - 1;
    var left = lastIdx > 0 ? (state.fromIdx / lastIdx) * 100 : 0;
    var right = lastIdx > 0 ? (state.toIdx / lastIdx) * 100 : 100;
    var pos = levels.indexOf(state.level);

    setControlsVisible(true);
    el("fromLabel").textContent = formatDay(from);
    el("toLabel").textContent = formatDay(to);
    el("rangeFill").style.left = left + "%";
    el("rangeFill").style.width = Math.max(right - left, 0) + "%";
    el("levelLabel").textContent = LEVELS[state.level];
    el("collapseBtn").disabled = pos <= 0;
    el("expandBtn").disabled = pos >= levels.length - 1;
}

function drawLatest(rows) {
    var days = Array.from(new Set(rows.map(function (row) {
        return row.day;
    }))).sort(function (a, b) {
        return b - a;
    });

    var latestRows = rows.filter(function (row) {
        return row.day === days[0];
    });

    var previousRows = days.length > 1
        ? rows.filter(function (row) {
            return row.day === days[1];
        })
        : [];

    var latest = summarize(latestRows);
    var previous = previousRows.length > 0 ? summarize(previousRows) : null;
    var suffix = days.length > 1 ? "vs " + formatDay(days[1]) : "";

    setContent(
        "<div class='" + CLS.latestWrap + "'>" +
        "<div class='" + CLS.title + "'>" + escapeHtml(state.title) + "</div>" +
        "<div class='" + CLS.value + "'>" + escapeHtml(latest.label) + "</div>" +
        "<div class='" + CLS.date + "'>" + escapeHtml(formatDay(days[0])) + "</div>" +
        deltaHtml(latest, previous, suffix, CLS.delta) +
        "</div>"
    );
}

function drawGroups(rows, level) {
    var groups = new Map();

    rows.forEach(function (row) {
        var info = groupInfo(row.day, level);

        if (!groups.has(info.key)) {
            groups.set(info.key, { label: info.label, firstDay: row.day, rows: [] });
        }

        var group = groups.get(info.key);
        group.rows.push(row);

        if (row.day < group.firstDay) {
            group.firstDay = row.day;
        }
    });

    var ordered = Array.from(groups.values()).sort(function (a, b) {
        return a.firstDay - b.firstDay;
    });

    var cards = ordered.map(function (group, index) {
        var current = summarize(group.rows);
        var previous = index > 0 ? summarize(ordered[index - 1].rows) : null;

        return "<div class='" + CLS.card + "'>" +
            "<div class='" + CLS.cardLabel + "'>" + escapeHtml(group.label) + "</div>" +
            "<div class='" + CLS.cardValue + "'>" + escapeHtml(current.label) + "</div>" +
            deltaHtml(current, previous, "", CLS.cardDelta) +
            "</div>";
    }).reverse();

    setContent(
        "<div class='" + CLS.groupTitle + "'>" + escapeHtml(state.title) + " per " + LEVELS[level].toLowerCase() + "</div>" +
        "<div class='" + CLS.grid + "'>" + cards.join("") + "</div>"
    );
}

function groupInfo(day, level) {
    var date = new Date(day);
    var year = date.getUTCFullYear();

    if (level === 1) {
        return { key: String(year), label: String(year) };
    }

    if (level === 2) {
        return {
            key: year + "-" + pad(date.getUTCMonth() + 1),
            label: date.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" })
        };
    }

    if (level === 3) {
        var iso = isoWeek(date);
        return {
            key: iso.year + "-W" + pad(iso.week),
            label: "W" + pad(iso.week) + " " + iso.year
        };
    }

    return { key: String(day), label: formatDay(day) };
}

function isoWeek(date) {
    var target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    var weekday = target.getUTCDay() || 7;
    target.setUTCDate(target.getUTCDate() + 4 - weekday);
    var yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
    var week = Math.ceil(((target - yearStart) / 86400000 + 1) / 7);

    return { year: target.getUTCFullYear(), week: week };
}

function deltaHtml(current, previous, suffix, cssBase) {
    if (!current.isNumeric || !previous || !previous.isNumeric) {
        return "";
    }

    var diff = current.raw - previous.raw;
    var pct = previous.raw !== 0 ? (diff / Math.abs(previous.raw)) * 100 : null;
    var colour = diff > 0 ? CLS.up : diff < 0 ? CLS.down : CLS.flat;
    var arrow = diff > 0 ? "&#9650;" : diff < 0 ? "&#9660;" : "&#9632;";

    return "<div class='" + cssBase + " " + colour + "'>" +
        arrow + " " + formatNumber(diff) +
        (pct !== null ? " (" + pct.toFixed(1) + "%)" : "") +
        (suffix ? " " + escapeHtml(suffix) : "") +
        "</div>";
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

function toDay(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    if (typeof value === "string") {
        var match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        if (match) {
            return Date.UTC(parseInt(match[1], 10), parseInt(match[2], 10) - 1, parseInt(match[3], 10));
        }
    }

    var date = value instanceof Date ? value : new Date(value);

    if (isNaN(date.getTime())) {
        return null;
    }

    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
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

function formatDay(day) {
    return new Date(day).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function formatNumber(value) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function pad(number) {
    return number < 10 ? "0" + number : String(number);
}

function setContent(html) {
    el("resultBox").innerHTML = "<div class='" + CLS.content + "'>" + html + "</div>";
}

function showMessage(html) {
    setControlsVisible(false);
    setContent("<div class='" + CLS.message + "'>" + html + "</div>");
}

function el(id) {
    return document.getElementById(id);
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}