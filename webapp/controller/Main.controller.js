sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "pho/com/serviceoverview/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, MessageToast, UIComponent, formatter, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("pho.com.serviceoverview.controller.Main", {
        formatter: formatter,
        onInit() {

            // const oGlobalModel = this.getOwnerComponent().getModel("global");
            // const sServiceEmployee = oGlobalModel ? oGlobalModel.getProperty("/serviceEmployee") : "9980000007";
            // // Filter für ServiceEmployee und Status
            // const aFilters = [
            //     new Filter("ServiceEmployee", FilterOperator.EQ, sServiceEmployee),
            //     new Filter("ServiceOrderStatusName", FilterOperator.AnyOf, ["In Process", "Released"])
            // ];
            // // Filter auf die Tabelle anwenden
            // const oTable = this.byId("idServiceTable");
            // const oBinding = oTable.getBinding("items");
            // oBinding.filter(aFilters);
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

