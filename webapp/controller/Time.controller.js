sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "pho/com/serviceoverview/formatter"
], function (Controller, JSONModel, MessageToast, Filter, FilterOperator, formatter) {
    "use strict";
   
    return Controller.extend("pho.com.serviceoverview.controller.Time", {
        formatter: formatter,
       
        onInit: function () {
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("Time").attachPatternMatched(this._onObjectMatched, this);
           
            const oFilteredModel = new JSONModel({
                results: [],
                to_Item: [],
                additionalData: {},
                hasItems: false 
            });
            this.getView().setModel(oFilteredModel, "filteredConfirmation");

            // View-Modell für zusätzliche Steuerung
            const oViewModel = new JSONModel({
                tableVisible: false
            });
            this.getView().setModel(oViewModel, "viewModel");
        },

        _onObjectMatched: function (oEvent) {
            let sOrderId = oEvent.getParameter("arguments").serviceOrder;

            if (sOrderId) {
                this._loadServiceConfirmationHeader(sOrderId); 
            } else {
                MessageToast.show("Keine gültige ServiceOrder gefunden!");
                this.getView().getModel("viewModel").setProperty("/tableVisible", false);
            }
        },
        
        _loadServiceConfirmationHeader: function (sOrderId) {
            const oConfirmationModel = this.getView().getModel("confirmation");
            const oFilteredModel = this.getView().getModel("filteredConfirmation");
            const oViewModel = this.getView().getModel("viewModel");
            const oFilter = new Filter("ReferenceServiceOrder", FilterOperator.EQ, sOrderId);
                        
            oConfirmationModel.read("/A_ServiceConfirmation", {
                filters: [oFilter],
                success: (oData) => {
                    if (oData?.results && Array.isArray(oData.results) && oData.results.length > 0) {
                        oFilteredModel.setProperty("/results", oData.results);
                        this._loadServiceConfirmation(sOrderId);
                        this._loadAdditionalData(sOrderId); 
                    } else {
                        oFilteredModel.setProperty("/results", []);
                        oViewModel.setProperty("/tableVisible", false);
                        MessageToast.show("Keine Service Confirmations gefunden!");
                    }
                },
                error: (oError) => {
                    console.error("Fehler beim Laden der Daten:", oError);
                    MessageToast.show("Fehler beim Laden der Daten!");
                    oFilteredModel.setProperty("/results", []);
                    oViewModel.setProperty("/tableVisible", false);
                }
            });
        },
        
        _loadServiceConfirmation: function (sOrderId) {
            const oConfirmationModel = this.getView().getModel("confirmation");
            const oFilteredModel = this.getView().getModel("filteredConfirmation");
            const oViewModel = this.getView().getModel("viewModel");
            const oFilter = new Filter("ReferenceServiceOrder", FilterOperator.EQ, sOrderId);

            oConfirmationModel.read("/A_ServiceConfirmationItem", {
                filters: [oFilter],
                success: (oData) => {
                    if (oData?.results && Array.isArray(oData.results) && oData.results.length > 0) {
                        oData.results.forEach(item => {
                            if (!item.ActualServiceStartDateTime) {
                                item.ActualServiceStartDateTime = new Date().toISOString(); // Aktuelles Datum als Fallback
                            }
                            if (!item.ActualServiceEndDateTime) {
                                item.ActualServiceEndDateTime = new Date().toISOString(); // Aktuelles Datum als Fallback
                            }
                        });
                        oFilteredModel.setProperty("/to_Item", oData.results);
                        oFilteredModel.setProperty("/hasItems", true);
                        oViewModel.setProperty("/tableVisible", true);
                    } else {
                        oFilteredModel.setProperty("/to_Item", []);
                        oFilteredModel.setProperty("/hasItems", false);
                        oViewModel.setProperty("/tableVisible", false);
                        MessageToast.show("Keine Items für diese Service Confirmation gefunden!");
                    }
                },
                error: (oError) => {
                    console.error("Fehler beim Laden der Daten:", oError);
                    MessageToast.show("Fehler beim Laden der Daten!");
                    oFilteredModel.setProperty("/to_Item", []);
                    oFilteredModel.setProperty("/hasItems", false);
                    oViewModel.setProperty("/tableVisible", false);
                }
            });
        },

        _loadAdditionalData: function (sOrderId) {
            const oMainModel = this.getView().getModel(); 
            const oFilteredModel = this.getView().getModel("filteredConfirmation");
            const oFilter = new Filter("ServiceOrder", FilterOperator.EQ, sOrderId); 
        
            oMainModel.read("/YY1_ServiceConfirmation", {
                filters: [oFilter],
                success: (oData) => {
                    if (oData?.results && oData.results.length > 0) {
                        oFilteredModel.setProperty("/additionalData", oData.results[0]);
                    } else {
                        oFilteredModel.setProperty("/additionalData", {});
                        MessageToast.show("Keine zusätzlichen Daten in YY1_ServiceConfirmation gefunden!");
                    }
                },
                error: (oError) => {
                    console.error("Fehler beim Laden der zusätzlichen Daten:", oError);
                    MessageToast.show("Fehler beim Laden der zusätzlichen Daten! Details: " + oError.message);
                    oFilteredModel.setProperty("/additionalData", {});
                }
            });
        },
        
        onSave: function () {
            const oFilteredModel = this.getView().getModel("filteredConfirmation");
            const oConfirmationModel = this.getView().getModel("confirmation");
            const aItems = oFilteredModel.getProperty("/to_Item");
        
            if (!aItems || aItems.length === 0) {
                MessageToast.show("Keine Items zum Speichern vorhanden!");
                return;
            }
        
            // Batch-Gruppe als "deferred" definieren
            oConfirmationModel.setDeferredGroups(["updateServiceConfirmationItems"]);
            oConfirmationModel.setUseBatch(true);
            const mBatchOperations = [];
        
            // Hilfsfunktion zur Konvertierung von Datumswerten in ISO-Format
            const formatDateToISO = (oDate) => {
                if (!oDate) return null;
                const oDateTime = new Date(oDate);
                return oDateTime.toISOString(); // Konvertiert zu z. B. "2025-04-03T00:00:00.000Z"
            };
        
            // Für jedes Item prüfen, ob es existiert, und entsprechend erstellen oder aktualisieren
            aItems.forEach((oItem, iIndex) => {
                // Daten für das Erstellen oder Aktualisieren vorbereiten
                const oData = {
                    ServiceConfirmation: oItem.ServiceConfirmation || "", // Muss gesetzt sein
                    ServiceConfirmationItem: oItem.ServiceConfirmationItem || "", // Muss gesetzt sein
                    Quantity: oItem.Quantity ? parseFloat(oItem.Quantity).toFixed(3) : "0.000",
                    QuantityUnit: oItem.QuantityUnit || "HR",
                    ActualServiceDuration: oItem.ActualServiceDuration ? parseFloat(oItem.ActualServiceDuration).toFixed(2) : "0.00",
                    ActualServiceDurationUnit: oItem.ActualServiceDurationUnit || "HR",
                    ActualServiceStartDateTime: formatDateToISO(oItem.ActualServiceStartDateTime),
                    ActualServiceEndDateTime: formatDateToISO(oItem.ActualServiceEndDateTime),
                    ReferenceServiceOrder: oItem.ReferenceServiceOrder || "", // Muss gesetzt sein
                    ReferenceServiceOrderItem: oItem.ReferenceServiceOrderItem || "0",
                    ServiceConfItemDescription: oItem.ServiceConfItemDescription || "Arbeitszeit",
                    Product: oItem.Product || "SRV_01", // Standardprodukt, falls nicht gesetzt
                    ExecutingServiceEmployee: oItem.ExecutingServiceEmployee || "9980000007", // Standardwert, falls nicht gesetzt
                    ServiceConfItemCategory: oItem.ServiceConfItemCategory || "SCP1", // Standardkategorie
                    ServiceConfItemIsCompleted: oItem.ServiceConfItemIsCompleted || "X",
                    Language: oItem.Language || "DE"
                };
        
                console.log(`Update-Daten für Item ${oItem.ServiceConfirmationItem}:`, oData); // Debugging
        
                // Pfad für das Item in der API
                const sPath = `/A_ServiceConfirmationItem(ServiceConfirmation='${oItem.ServiceConfirmation}',ServiceConfirmationItem='${oItem.ServiceConfirmationItem}')`;
        
                // Prüfen, ob der Eintrag existiert
                oConfirmationModel.read(sPath, {
                    success: (oExistingData) => {
                        // Eintrag existiert → Aktualisieren (PATCH)
                        const oUpdateData = {
                            Quantity: oData.Quantity,
                            QuantityUnit: oData.QuantityUnit,
                            ActualServiceDuration: oData.ActualServiceDuration,
                            ActualServiceDurationUnit: oData.ActualServiceDurationUnit,
                            ActualServiceStartDateTime: oData.ActualServiceStartDateTime,
                            ActualServiceEndDateTime: oData.ActualServiceEndDateTime
                        };
        
                        mBatchOperations.push({
                            method: "PATCH",
                            path: sPath,
                            data: oUpdateData
                        });
        
                        // Batch-Request ausführen, wenn alle Items verarbeitet wurden
                        if (mBatchOperations.length === aItems.length) {
                            this._submitBatch(oConfirmationModel, mBatchOperations, aItems[0].ReferenceServiceOrder);
                        }
                    },
                    error: (oError) => {
                        // Eintrag existiert nicht → Erstellen (POST)
                        if (oError.statusCode === 404) {
                            mBatchOperations.push({
                                method: "POST",
                                path: "/A_ServiceConfirmationItem",
                                data: oData
                            });
                        } else {
                            console.error("Fehler beim Prüfen des Eintrags:", oError);
                            MessageToast.show("Fehler beim Prüfen des Eintrags!");
                        }
        
                        // Batch-Request ausführen, wenn alle Items verarbeitet wurden
                        if (mBatchOperations.length === aItems.length) {
                            this._submitBatch(oConfirmationModel, mBatchOperations, aItems[0].ReferenceServiceOrder);
                        }
                    }
                });
            });
        },
        
        // Hilfsfunktion zum Ausführen des Batch-Requests
        _submitBatch: function (oConfirmationModel, mBatchOperations, sReferenceServiceOrder) {
            if (mBatchOperations.length === 0) {
                MessageToast.show("Keine Änderungen zum Speichern!");
                return;
            }
        
            oConfirmationModel.submitChanges({
                groupId: "updateServiceConfirmationItems",
                success: () => {
                    MessageToast.show("Änderungen erfolgreich gespeichert!");
                    // Daten neu laden, um die Tabelle zu aktualisieren
                    this._loadServiceConfirmation(sReferenceServiceOrder);
                },
                error: (oError) => {
                    let sErrorMessage = "Fehler beim Speichern der Änderungen!";
                    try {
                        const oErrorResponse = JSON.parse(oError.responseText);
                        sErrorMessage = oErrorResponse.error.message.value || sErrorMessage;
                    } catch (e) {
                        console.error("Fehler beim Parsen der Fehlermeldung:", e);
                    }
                    MessageToast.show(sErrorMessage);
                }
            });
        }


    });
});