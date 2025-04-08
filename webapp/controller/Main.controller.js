sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "pho/com/serviceoverview/formatter" 
], (Controller, MessageToast, UIComponent, formatter) => {
    "use strict";

    return Controller.extend("pho.com.serviceoverview.controller.Main", {
        formatter: formatter,
        onInit() {
            
        },
            onServiceOrderPress: function (oEvent) {
      
            let oRouter = this.getOwnerComponent().getRouter();
            let oItem = oEvent.getSource();
            let oContext = oItem.getBindingContext();
            
            if (oContext) {
                let sOrderId = oContext.getProperty("ServiceOrder"); 
                console.log("Service Order ID:", sOrderId);
                oRouter.navTo("Time", { serviceOrder: sOrderId }); 
            } else {
                sap.m.MessageToast.show("Keine ServiceOrder gefunden!");
            }
        }
       
        
    });
});

