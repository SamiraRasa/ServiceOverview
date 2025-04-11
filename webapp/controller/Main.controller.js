sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/UIComponent",
    "pho/com/serviceoverview/formatter",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel"
], (Controller, MessageToast, UIComponent, formatter, Filter, FilterOperator, JSONModel) => {
    "use strict";
 
    return Controller.extend("pho.com.serviceoverview.controller.Main", {
        formatter: formatter,
 
        onInit: function() {
            const oServiceConfirmationModel = this.getOwnerComponent().getModel(); // YY1_ServiceConfirmation
            const oServiceOrderModel = this.getOwnerComponent().getModel("serviceOrder"); // API_SERVICE_ORDER_SRV
            const oServiceConfModel = this.getOwnerComponent().getModel("confirmation"); // API_SERVICE_ORDER_SRV
 
            // Festgelegter ExecutingServiceEmployee
            const sServiceEmployee = "9980000012"; // Statisch gesetzt auf 9980000012
 
            this._loadAndFilterDataByEmployee(oServiceConfirmationModel, oServiceOrderModel, sServiceEmployee);
        },
 
        _loadAndFilterDataByEmployee: function(oServiceConfirmationModel, oServiceOrderModel, sServiceEmployee) {
            const oTable = this.byId("idServiceTable");
 
            // Filter für ExecutingServiceEmployee = "9980000012"
            const oFilter = new Filter("ExecutingServiceEmployee", FilterOperator.EQ, sServiceEmployee);
 
            oServiceOrderModel.read("/A_ServiceOrderItem", {
                filters: [oFilter], // Filter anwenden
                success: (oItemData) => {
                    const aServiceOrderItems = oItemData.results;
 
                    oServiceConfirmationModel.read("/YY1_ServiceConfirmation", {
                        success: (oConfData) => {
                            const aServiceConfirmations = oConfData.results;
 
                            // Join der Daten mit den gefilterten ServiceOrderItems
                            const aEnhancedData = aServiceConfirmations.map(conf => {
                                const matchingItems = aServiceOrderItems.filter(item =>
                                    item.ServiceOrder === conf.ServiceOrder
                                );
                                const executingEmployee = matchingItems.length > 0
                                    ? matchingItems[0].ExecutingServiceEmployee
                                    : "Nicht zugeordnet";
 
                                return {
                                    ...conf,
                                    ExecutingServiceEmployee: executingEmployee
                                };
                            });
 
                            // Entferne Duplikate basierend auf ServiceOrder
                            const aUniqueData = this._removeDuplicates(aEnhancedData, "ServiceOrder");
 
                            const oJSONModel = new JSONModel(aUniqueData);
                            this.getView().setModel(oJSONModel, "uniqueData");
 
                            oTable.bindItems({
                                path: "uniqueData>/",
                                sorter: { path: "ServiceOrder" },
                                template: oTable.getBindingInfo("items").template
                            });
                        },
                        error: (oError) => {
                            console.error("Error loading ServiceConfirmation data:", oError);
                            MessageToast.show("Fehler beim Laden der ServiceConfirmation-Daten!");
                        }
                    });
                },
                error: (oError) => {
                    console.error("Error loading ServiceOrderItem data:", oError);
                    MessageToast.show("Fehler beim Laden der ServiceOrderItem-Daten!");
                }
            });
        },
 
        _removeDuplicates: function(aData, sKey) {
            const seen = new Set();
            return aData.filter(item => {
                const keyValue = item[sKey];
                if (!seen.has(keyValue)) {
                    seen.add(keyValue);
                    return true;
                }
                return false;
            });
        },
 
        onServiceOrderPress: function(oEvent) {
            let oRouter = this.getOwnerComponent().getRouter();
            let oItem = oEvent.getSource();
            let oContext = oItem.getBindingContext("uniqueData");
           
            if (oContext) {
                let sOrderId = oContext.getProperty("ServiceOrder");
                console.log("Service Order ID:", sOrderId);
                oRouter.navTo("Time", { serviceOrder: sOrderId });
            } else {
                MessageToast.show("Keine ServiceOrder gefunden!");
            }
        }
    });
});