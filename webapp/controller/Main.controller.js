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
            const oServiceConfirmationModel = this.getOwnerComponent().getModel('YY1'); // YY1_ServiceConfirmation
            const oServiceOrderModel = this.getOwnerComponent().getModel("serviceOrder"); // API_SERVICE_ORDER_SRV
            const oServiceConfModel = this.getOwnerComponent().getModel("confirmation"); // API_SERVICE_CONFIRMATION__SRV
            this.oCacheModel = this.getOwnerComponent().getModel("cache");
         
            const sServiceEmployee = "9980000012"; // For specific employee filter
            // const sServiceEmployee = null; // For no filter
 
            this.oCacheModel = new JSONModel({
                serviceOrderItems: [],
                serviceConfirmations: []
            });
         
            this.getView().setModel(this.oCacheModel, "cache");
 
            this._loadAndFilterDataByEmployee(oServiceConfirmationModel, oServiceOrderModel, sServiceEmployee);
        },
 
        onSortByPriority: function () {
            var oTable = this.byId("idServiceTable");
            var oBinding = oTable.getBinding("items");
             
            this._bSortAscending = !this._bSortAscending;
       
            var oSorter = new sap.ui.model.Sorter("ServiceDocumentPriority", !this._bSortAscending);
            oBinding.sort(oSorter);
        },
 
        _loadAndFilterDataByEmployee: function(oServiceConfirmationModel, oServiceOrderModel, sServiceEmployee) {
            const oTable = this.byId("idServiceTable");
            const aFilters = [];
 
            if (sServiceEmployee) {
                const oFilter = new Filter("ExecutingServiceEmployee", FilterOperator.EQ, sServiceEmployee);
                aFilters.push(oFilter);
            }
 
            oServiceOrderModel.read("/A_ServiceOrderItem", {
                filters: aFilters,
                success: (oItemData) => {
                    const aServiceOrderItems = oItemData.results;
                    console.log(sServiceEmployee
                        ? `Filtered ServiceOrderItems for employee ${sServiceEmployee}:`
                        : "All ServiceOrderItems:", aServiceOrderItems);
 
                    if (aServiceOrderItems.length === 0) {
                        MessageToast.show(sServiceEmployee
                            ? `No ServiceOrderItems found for employee ${sServiceEmployee}.`
                            : "No ServiceOrderItems found.");
                    }
 
                    oServiceConfirmationModel.read("/YY1_ServiceConfirmation", {
                        success: (oConfData) => {
                            const aServiceConfirmations = oConfData.results;
 
                            if (this.oCacheModel) {
                                this.oCacheModel.setProperty("/serviceOrderItems", aServiceOrderItems);
                                this.oCacheModel.setProperty("/serviceConfirmations", aServiceConfirmations);
                            } else {
                                console.error("Cache model is not defined!");
                            }
                           
                            const aEnhancedData = aServiceConfirmations.map(conf => {
                                const matchingItems = aServiceOrderItems.filter(item =>
                                    item.ServiceOrder === conf.ServiceOrder
                                );
                                const executingEmployee = matchingItems.length > 0
                                    ? matchingItems[0].ExecutingServiceEmployee
                                    : "Not assigned";
 
                                return {
                                    ...conf,
                                    ExecutingServiceEmployee: executingEmployee
                                };
                            }).filter(conf =>
                                !sServiceEmployee || conf.ExecutingServiceEmployee === sServiceEmployee
                            );
 
                            const aFilteredData = aEnhancedData.filter(conf => conf.ServiceOrderStatusName === "Released");
                            const aUniqueData = this._removeDuplicates(aFilteredData, "ServiceOrder");
                            console.log("Final data:", aUniqueData);
 
                            const oJSONModel = new JSONModel(aUniqueData);
                            this.getView().setModel(oJSONModel, "uniqueData");
 
                            oTable.bindItems({
                                path: "uniqueData>/",
                                sorter: { path: "ServiceOrder" },
                                template: oTable.getBindingInfo("items").template
                            });
 
                            if (aUniqueData.length === 0) {
                                MessageToast.show(sServiceEmployee
                                    ? `No data available for employee ${sServiceEmployee}.`
                                    : "No data available.");
                            }
                        },
                        error: (oError) => {
                            console.error("Error loading ServiceConfirmation data:", oError);
                            MessageToast.show("Error loading ServiceConfirmation data!");
                        }
                    });
                },
                error: (oError) => {
                    console.error("Error loading ServiceOrderItem data:", oError);
                    MessageToast.show("Error loading ServiceOrderItem data!");
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
                MessageToast.show("No ServiceOrder found!");
            }
        },
 
        onToggleFilter: function(sEmployeeId) {
            const oTable = this.byId("idServiceTable");
 
            const aServiceOrderItems = this.oCacheModel.getProperty("/serviceOrderItems");
            const aServiceConfirmations = this.oCacheModel.getProperty("/serviceConfirmations");
 
            const aEnhancedData = aServiceConfirmations.map(conf => {
                const matchingItems = aServiceOrderItems.filter(item =>
                    item.ServiceOrder === conf.ServiceOrder
                );
                const executingEmployee = matchingItems.length > 0
                    ? matchingItems[0].ExecutingServiceEmployee
                    : "Not assigned";
 
                return {
                    ...conf,
                    ExecutingServiceEmployee: executingEmployee
                };
            }).filter(conf =>
                !sEmployeeId || conf.ExecutingServiceEmployee === sEmployeeId
            );
 
            const aFilteredData = aEnhancedData.filter(conf => conf.ServiceOrderStatusName === "Released");
 
            const aUniqueData = this._removeDuplicates(aFilteredData, "ServiceOrder");
 
            console.log("Final data after toggle:", aUniqueData);
 
            const oJSONModel = new JSONModel(aUniqueData);
            this.getView().setModel(oJSONModel, "uniqueData");
 
            oTable.bindItems({
                path: "uniqueData>/",
                sorter: { path: "ServiceOrder" },
                template: oTable.getBindingInfo("items").template
            });
 
            if (aUniqueData.length === 0) {
                MessageToast.show(sEmployeeId
                    ? `No data available for employee ${sEmployeeId}.`
                    : "No data available.");
            }
        }
    });
});