sap.ui.define([], function () {
    "use strict";

    return {
        priorityText: function (iPriority) {
            iPriority = parseInt(iPriority, 10); 
            if (iPriority === 0) return "nicht";
            if (iPriority >= 7 && iPriority<= 9) return "Low";
            if (iPriority >= 5 && iPriority < 7) return "Medium";
            if (iPriority >= 3 && iPriority < 5) return "High";
            if (iPriority >= 1 && iPriority < 3) return "Very high";
            return ""; 
        },
        visibleIfService: function (sItem) {
            return sItem === "10" ;
        }
    };
});