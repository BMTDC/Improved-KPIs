 tableau.extensions.initializeAsync().then(function() {
      // Initialization succeeded! 
      //Add your JavaScript code here to call the Extensions API
  });function initialize() {
    tableau.extensions.initializeAsync().then(function () {
     // Initialization succeeded! Get the dashboard
        var worksheet = tableau.extensions.worksheetContent.worksheet;
        document.getElementById("resultBox").innerHTML = "I'm running in a dashboard named <strong>" + worksheet.name + "</strong>";
     }, function (err) {
     // something went wrong in initialization
      document.getElementById("resultBox").innerHTML = "Error while Initializing: " + err.toString();
    });
}