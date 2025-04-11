sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "pho/com/serviceoverview/formatter",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageToast, MessageBox, Filter, FilterOperator, formatter, History) {
    "use strict";

    return Controller.extend("pho.com.serviceoverview.controller.Time", {
        formatter: formatter,

        onInit: function () {
            let oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("Time").attachPatternMatched(this._onObjectMatched, this);

            const oFilteredModel = new JSONModel({
                serviceOrder: {},
                results: [],
                to_Item: [],
                additionalData: {},
                hasItems: false
            });
            this.getView().setModel(oFilteredModel, "filteredConfirmation");

            // View-Modell für zusätzliche Steuerung
            // const oViewModel = new JSONModel({
            //     tableVisible: false
            const oServiceOrderModel = new JSONModel({
                to_Item: []
            });
            this.getView().setModel(oServiceOrderModel, "serviceOrder");
            let oViewModel = new JSONModel({
                selectedTab: "orders", // Default to confirmations tab // orders we need as first
                tableVisible: true
            });
            this.getView().setModel(oViewModel, "viewModel");
        },

        _onObjectMatched: function (oEvent) {
            let sOrderId = oEvent.getParameter("arguments").serviceOrder;

            if (sOrderId) {
                this._loadServiceOrder(sOrderId);
                this._loadServiceOrderItems(sOrderId);
                this._loadAdditionalData(sOrderId);
                this._loadServiceConfirmationHeader(sOrderId);
                this._sOrderId = sOrderId;
            } else {
                MessageToast.show("Keine gültige ServiceOrder gefunden!");
                this.getView().getModel("viewModel").setProperty("/tableVisible", false);
            }
        },

        onTabChange: function (oEvent) {
            var sSelectedKey = oEvent.getParameter("item").getKey();
            this.getView().getModel("viewModel").setProperty("/selectedTab", sSelectedKey);
            // Prüfen ob sOrderId verfügbar ist
            if (sSelectedKey === "orders" && this._sOrderId) {
                this._loadServiceOrderItems(this._sOrderId);
            } else if (sSelectedKey === "orders") {
                MessageToast.show("Keine ServiceOrder-ID verfügbar");
            }
        },

        _loadServiceOrder: function (sOrderId) {
            const oServiceOrderModel = this.getOwnerComponent().getModel("serviceOrder");
            const oJSONModel = this.getView().getModel("serviceOrder");

            oServiceOrderModel.read(`/A_ServiceOrder('${sOrderId}')`, {
                success: function (oData) {
                    oJSONModel.setProperty("/serviceOrder", oData);
                    oJSONModel.refresh(true);
                    // this.getView().setModel(oJSONModel, "serviceOrder");
                },
                error: function (oError) {
                    console.error(oError);
                }
            });

        },

        _loadServiceOrderItems: function (sOrderId) {
            const oODataModel = this.getOwnerComponent().getModel("serviceOrder");
            const oJSONModel = this.getView().getModel("serviceOrder");

            oODataModel.read("/A_ServiceOrderItem", {
                urlParameters: {
                    "$select": "ServiceOrderItemCategory,QuantityUnit,Quantity,ServiceOrderItemDescription,Product,ServiceOrderItem",
                    "$filter": `(ServiceOrder eq '${sOrderId}') and (Product eq 'SRV_01')`
                },
                success: (oData) => {
                    oJSONModel.setProperty("/to_Item", oData.results);
                    console.log("Received data:", oData);
                    console.log("JSONModel data:", oJSONModel.getData());
                    oJSONModel.refresh(true);
                },
                error: (oError) => {
                    console.error("Error details:", oError);
                    // MessageToast.show("Error fetching service order items: " + oError.message);
                    oJSONModel.setProperty("/to_Item", []);
                    oJSONModel.refresh(true);
                }
            });
        },

        _loadServiceOrderItems_original: function (sOrderId) {
            console.log("Loading service order items for:", sOrderId);

            // ODataModel aus der manifest.json
            const oODataModel = this.getOwnerComponent().getModel("serviceOrder");
            // JSONModel für die lokale Speicherung
            const oJSONModel = this.getView().getModel("serviceOrder");

            const sPath = "/A_ServiceOrderItem";
            const oFilter = new Filter("ServiceOrder", FilterOperator.EQ, sOrderId);

            oODataModel.read(sPath, {
                filters: [oFilter],
                success: function (oData) {

                    const filteredItems = oData.results.filter(item => item.Product === "SRV_01" /*item.ServiceOrderItem === "10"*/);
                    oJSONModel.setProperty("/to_Item", filteredItems);
                    console.log("Received data:", oData);
                    console.log("JSONModel data:", oJSONModel.getData());
                    oJSONModel.refresh(true); // UI aktualisieren
                    // MessageToast.show("Service order items loaded successfully!");
                }.bind(this),
                error: function (oError) {
                    console.error("Error details:", oError);
                    // MessageToast.show("Error fetching service order items: " + oError.message);
                    oJSONModel.setProperty("/to_Item", []);
                    oJSONModel.refresh(true);
                }.bind(this)
            });
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
                        //this._loadServiceConfirmationItem(sOrderId);
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
                        const filteredItems = oData.results.filter(item => item.ServiceConfirmationItem === "10");
                        oFilteredModel.setProperty("/to_Item", filteredItems);
                        oFilteredModel.setProperty("/hasItems", filteredItems.length > 0);
                        oViewModel.setProperty("/tableVisible", filteredItems.length > 0);
                        const sServiceEmployee = filteredItems[0]?.ExecutingServiceEmployee || "";
                        this.getOwnerComponent().setModel(new sap.ui.model.json.JSONModel({ serviceEmployee: sServiceEmployee }), "global");
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



        _loadServiceConfirmationItem: function (sOrderId) {
            const oODataModel = this.getOwnerComponent().getModel("confirmationService");
            const oFilteredConfirmationModel = this.getView().getModel("filteredConfirmation");
            const oViewModel = this.getView().getModel("viewModel");

            oODataModel.read("/A_ServiceConfirmationItem", {
                urlParameters: {
                    "$select": "ServiceConfirmation,ServiceConfirmationItem,Product,ServiceConfItemDescription,Quantity,QuantityUnit",
                    "$filter": `(ReferenceServiceOrder eq '${sOrderId}') and (Product eq 'SRV_01')`
                },
                success: (oData) => {
                    if (oData?.results?.length) {
                        const aConfirmationItems = oData.results;
                        aConfirmationItems.forEach(item => {
                            if (!item.ActualServiceStartDateTime) {
                                item.ActualServiceStartDateTime = new Date().toISOString(); // Aktuelles Datum als Fallback
                            }
                            if (!item.ActualServiceEndDateTime) {
                                item.ActualServiceEndDateTime = new Date().toISOString();
                            }
                        });
                        debugger;
                        oFilteredConfirmationModel.setProperty("/to_Item", aConfirmationItems);
                        oFilteredConfirmationModel.setProperty("/hasItems", aConfirmationItems.length > 0);
                        oViewModel.setProperty("/tableVisible", aConfirmationItems.length > 0);
                    } else {
                        oFilteredConfirmationModel.setProperty("/to_Item", []);
                        oFilteredConfirmationModel.setProperty("/hasItems", false);
                        oViewModel.setProperty("/tableVisible", false);
                    }
                },
                error: (oError) => {
                    debugger;
                    console.error("Error details:", oError);
                    oFilteredConfirmationModel.setProperty("/to_Item", []);
                    oFilteredConfirmationModel.setProperty("/to_Item", []);
                    oFilteredConfirmationModel.setProperty("/hasItems", false);
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

        onConfirmButtonPress: function (oEvent) {
            const oFilteredModel = this.getView().getModel("filteredConfirmation");
            const oServiceOrderModel = this.getView().getModel("serviceOrder");
            const oConfirmationModel = this.getView().getModel("confirmation");
            const aItems = oServiceOrderModel.getProperty("/to_Item");
            const oServiceOrder = oServiceOrderModel.getProperty("/serviceOrder");

    //         if (!oServiceOrderModel) {
     //            console.error(this._getText("modelNotFound", "serviceOrder"));
     //        }

      //       if (!oConfirmationModel) {
      //           console.error(this._getText("modelNotFound", "confirmation"));
       //      }

      //       if (!aItems || aItems.length === 0) {
       //          MessageToast.show(this._getText("noItemsToConfirm"));
       //          return;
       //      }

            // Sammle Informationen der Service Order
            var sServiceOrderId = oServiceOrder.ServiceOrder;
            var sServiceObjectType = oServiceOrder.ServiceObjectType;
            var sServiceOrderType = oServiceOrder.ServiceOrderType;
            var aServiceOrderItemsToConfirm = [];

            // Fehlende Felder sammeln
        //     let aFehlendeFelder = [];
       //      if (!sServiceOrderId) aFehlendeFelder.push("confirmation");
      //       if (!sServiceObjectType) aFehlendeFelder.push("confirmation");
       //      if (!sServiceOrderType) aFehlendeFelder.push("confirmation");
// 
            // Hinweis anzeigen, wenn etwas fehlt
       //      if (aFehlendeFelder.length > 0) {
      //           MessageToast.show(this._getText("bitteFelderAusfuellen", "confirmation", [aFehlendeFelder.join(", ")]));
      //           return;
    //         }


            // Sammle Informationen der Service Order Items
            aItems.forEach((oOrderItem) => {
                aServiceOrderItemsToConfirm.push({
                    ReferenceServiceOrder: sServiceOrderId,
                    ReferenceServiceOrderItem: oOrderItem.ServiceOrderItem
                });
            });

            //Quantity: String(oOrderItem.Quantity)




            // Fülle das "JSON"-Objekt mit den gesammelten Informationen
            const oPayload = {
                ServiceConfirmationType: sServiceOrderType,
                ServiceObjectType: sServiceObjectType,
                ReferenceServiceOrder: sServiceOrderId,
                ServiceConfirmationIsFinal: "N",
                to_Item: {
                    results: aServiceOrderItemsToConfirm
                }
            };

            debugger;

            oConfirmationModel.create("/A_ServiceConfirmation", oPayload, {
                success: (oData , response) => {
                    console.log("Response:", oData, response);
                    MessageToast.show(this._getText("confirmationSuccess"));

                },
                error: (oError) => {
                    console.error(oError);
                    MessageToast.show(this._getText("confirmationSuccess"));
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
        },



        /**
         * Lädt den Text aus der i18n-Datei.
         * @param {string} [sKey] - Der Schlüssel des Textes in der i18n-Datei.
         * @returns {string} - Der Text aus der i18n-Datei.
         * @private
         */
        _getText: function (sKey) {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle().getText(sKey);
        },

        /**
         * Navigiert zurück, oder wenn keine History vorhanden ist, zur definierten Route.
         * @param {string} [sFallbackRoute="RouteMain"] - Die Route, zu der navigiert werden soll, wenn keine History vorhanden ist.
         * @returns {void}
         * @private
         * @example
         * this._navBackOrHome("RouteMain");
         */
        _navBackOrHome: function (sFallbackRoute = "RouteAuslieferungen") {
            const oHistory = History.getInstance();
            const sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo(sFallbackRoute, {}, undefined, true);
            }
        },


    });
});