tableau.extensions.initializeAsync().then(function() {
    // Initialization succeeded!
    // Add your JavaScript code here to call the Extensions API
});

function initialize() {
    tableau.extensions.initializeAsync().then(function () {
        // Initialization succeeded! Get the worksheet
        var worksheet = tableau.extensions.worksheetContent.worksheet;

        // Get the dimensions and measures included in the worksheet
        worksheet.getSummaryDataAsync().then(function (dataTable) {

            var fields = dataTable.columns;
            var data = dataTable.data;

            // All fields included in the worksheet
            console.log("Fields:", fields);

            // Names of all dimensions/measures
            fields.forEach(function (field) {
                console.log(
                    "Field:",
                    field.fieldName,
                    "Data type:",
                    field.dataType
                );
            });

            // The actual worksheet data
            console.log("Data:", data);

            document.getElementById("resultBox").innerHTML =
                "I'm running in a worksheet named <strong>" +
                worksheet.name +
                "</strong><br><br>" +
                "Fields included:<br>" +
                fields.map(function (field) {
                    return field.fieldName;
                }).join("<br>");

        }).catch(function (err) {
            document.getElementById("resultBox").innerHTML =
                "Error while getting worksheet data: " +
                err.toString();
        });

    }, function (err) {
        // Something went wrong in initialization
        document.getElementById("resultBox").innerHTML =
            "Error while Initializing: " +
            err.toString();
    });
}
