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
        serviceOrderItemActions: {
            RELEASE: "ServiceOrderItemIsReleased",
            COMPLETE: "ServiceOrderItemIsCompleted",
            REJECT: "ServiceOrderItemIsRejected"
        },

        onInit: function () {
            this._onResetUI();
            sap.ui.core.UIComponent.getRouterFor(this)?.getRoute("Time").attachPatternMatched(this._onObjectMatched, this);
        },

        onTabChange: function (oEvent) {
            var sSelectedKey = oEvent.getParameter("item").getKey();
            this._switchTab(sSelectedKey);
        },

        /******************************************************
         * Service Order Tab
         ******************************************************/
        onToggleOrderItemSelect: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("serviceOrder");
            if (oCtx) {
                const bSelected = oCtx.getProperty("selected");
                oCtx.setProperty("selected", !bSelected);
                this._updateHasSelectedConfirmationItems();
            }
        },

        onOrderItemStepInputChange: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("serviceOrder");
            if (oCtx && !oCtx.getProperty("selected")) {
                oCtx.setProperty("selected", true);
                this._updateHasSelectedConfirmationItems();
            }
        },

        onCreateServiceConfirmationButtonPress: function (oEvent) {
            const oServiceOrderModel = this.getView().getModel("serviceOrder");
            const oConfirmationModel = this.getView().getModel("confirmation");
            const aItems = oServiceOrderModel.getProperty("/to_Item")?.filter(item => item.selected);
            const oServiceOrder = oServiceOrderModel.getProperty("/serviceOrder");

            this._setBusy(true);

            if (!oServiceOrderModel) {
                console.error(this._i18n().getText("modelNotFound", "serviceOrder"));
                this._setBusy(false);
                return;
            }

            if (!oConfirmationModel) {
                console.error(this._i18n().getText("modelNotFound", "confirmation"));
                this._setBusy(false);
                return;
            }

            if (!aItems || aItems.length === 0) {
                MessageToast.show(this._i18n().getText("noOrderItemsSelectedToConfirm"));
                this._setBusy(false);
                return;
            }

            // Sammle Informationen der Service Order
            const sServiceOrderId = oServiceOrder.ServiceOrder;
            const sServiceObjectType = oServiceOrder.ServiceObjectType;
            const sServiceOrderType = oServiceOrder.ServiceOrderType;
            const aServiceOrderItemsToConfirm = [];
            var sServiceConfirmationType = '';

            // Fehlende Felder sammeln
            const aFehlendeFelder = [];
            if (!sServiceOrderId) aFehlendeFelder.push(this._i18n().getText("feldServiceOrder"));
            if (!sServiceObjectType) aFehlendeFelder.push(this._i18n().getText("feldServiceObjectType"));
            if (!sServiceOrderType) aFehlendeFelder.push(this._i18n().getText("feldServiceOrderType"));

            // Hinweis anzeigen, wenn etwas fehlt
            if (aFehlendeFelder.length > 0) {
                MessageToast.show(this._i18n().getText("bitteFelderAusfuellen", [aFehlendeFelder.join(", ")]));
                this._setBusy(false);
                return;
            }

            // Mapping des Service Order Typs
            sServiceConfirmationType = this._mapServiceConfirmationType(sServiceOrderType);
            if (!sServiceConfirmationType) {
                MessageToast.show(this._i18n().getText("noServiceConfirmationTypeMapping", [sServiceOrderType]));
                this._setBusy(false);
                return;
            }

            // Sammle Informationen der Service Order Items
            aItems.forEach((oOrderItem) => {
                aServiceOrderItemsToConfirm.push({
                    ReferenceServiceOrder: oOrderItem.ServiceOrder,
                    ReferenceServiceOrderItem: oOrderItem.ServiceOrderItem,
                    ExecutingServiceEmployee: '9980000012', // ToDo: delete this line and check earlier if employee is set
                    // Quantity: String(oOrderItem.Quantity)
                });
            });

            //Quantity: String(oOrderItem.Quantity)
            const oPayload = {
                ServiceConfirmationType: sServiceConfirmationType,
                ServiceObjectType: sServiceObjectType,
                ReferenceServiceOrder: sServiceOrderId,
                ServiceConfirmationIsFinal: "N",
                to_Item: {
                    results: aServiceOrderItemsToConfirm
                }
            };

            oConfirmationModel.create("/A_ServiceConfirmation", oPayload, {
                success: (oData, response) => {
                    MessageBox.success(this._i18n().getText("createServiceConfirmationSuccess"), {
                        onClose: () => {
                            this._loadServiceConfirmationItems(this._sOrderId);
                            this._setBusy(false);
                            this._switchTab("confirmations");
                        }
                    });
                },
                error: (oError) => {
                    console.error(oError);
                    MessageBox.error(this._i18n().getText("createServiceConfirmationError"), {
                        onClose: () => {
                            this._setBusy(false);
                        }
                    });
                }
            });

        },
        
        
        
        /******************************************************
         * Service Order Tab
         ******************************************************/
        onConfirmationItemSelectChange: function (oEvent) {
            const sSelectStatus = oEvent.getParameter("selected");
            if (sSelectStatus) {
                const oFilteredModel = this.getView().getModel("filteredConfirmation");
                oFilteredModel.setProperty("/hasSelectedItems", sSelectStatus);
                return;
            }
            this._updateHasSelectedConfirmationItems();
        },
        
        onToggleConfirmationItemSelect: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("filteredConfirmation");
            if (!oCtx || oCtx?.getProperty("ServiceConfItemIsCompleted") === "X") {
                MessageToast.show(this._i18n().getText("confirmationItemAlreadyCompleted"));
                return;
            }
            const bSelected = oCtx.getProperty("selected");
            oCtx.setProperty("selected", !bSelected);
            this._updateHasSelectedConfirmationItems();
        },

        onConfirmationItemStepInputChange: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("filteredConfirmation");
            if (oCtx && !oCtx.getProperty("selected")) {
                oCtx.setProperty("selected", true);
                this._updateHasSelectedConfirmationItems();
            }
        },
        
        onConfirmServiceItemsButtonPress: function (oEvent) {
            const oConfirmationModel = this.getView().getModel("confirmation");
            const oFilteredModel = this.getView().getModel("filteredConfirmation");
            const oViewModel = this.getView().getModel("viewModel");
            const aItems = oFilteredModel.getProperty("/to_Item");
            const iSelectedItemCount = aItems.filter(item => item.selected).length;

            this._setBusy(true);

            if (!oConfirmationModel) {
                console.error(this._i18n().getText("modelNotFound", "confirmation"));
                this._setBusy(false);
                return;
            }

            if (!aItems || aItems.length === 0) {
                MessageBox.warning(this._i18n().getText("noConfirmationItemsToConfirm"), {
                    onClose: () => {
                        this._switchTab("orders");
                        this._setBusy(false);
                        return;
                    }
                });
                return;
            }

            if (iSelectedItemCount <= 0) {
                MessageToast.show(this._i18n().getText("noConfirmationItemsSelectedToConfirm"));
                this._setBusy(false);
                return;
            }


            // Parse all Service Confirmation Items who are selected
            var iProcessed = 0;

            const checkIfAllDone = () => {
                iProcessed++;
                console.log("Processed items:", iProcessed, "of", iSelectedItemCount);
                if (iProcessed >= iSelectedItemCount) {
                    MessageBox.information(this._i18n().getText("patchServiceConfiormationComplete"), {
                        onClose: () => {
                            oFilteredModel.setProperty("/to_Item", aItems);
                            oFilteredModel.refresh(true);
                            this._setBusy(false);
                            // ToDo: Check if all items in the list updates values in UI, if not, uncomment next line
                            // this._loadServiceConfirmationItems(this._sOrderId);
                        }
                    });
                    this._updateHasSelectedConfirmationItems();
                }
            };

            aItems.forEach((oItem) => {
                if (!oItem.selected) {
                    return;
                }
                console.info("oItem:", oItem);
                this._updateConfirmationItemQuantityToBackend(oItem).then(() => {
                    // Update the Service Confirmation Item in the backend
                    const sPath = "/A_ServiceConfirmationItem(ServiceConfirmation=%27" + oItem.ServiceConfirmation + "%27,ServiceConfirmationItem=%27" + oItem.ServiceConfirmationItem + "%27)";
                    const oPayload = {
                        ServiceConfItemIsCompleted: "X"
                    };
                    debugger;
                    oConfirmationModel.update(sPath, oPayload, {
                        method: "PATCH",
                        success: (oData, response) => {
                            // Uncheck the item in the UI
                            oItem.selected = false;
                            oItem.ServiceConfItemIsCompleted = "X";
                            oFilteredModel.refresh(true);
                            console.log("Update erfolgreich:", oData, response);
                            checkIfAllDone();
                        },
                        error: (oError) => {
                            console.error("Fehler beim Update:", oError);
                            MessageToast.show(this._i18n().getText("updateServiceConfirmationItemError"));
                            checkIfAllDone();
                        }
                    });
                    
                }).catch((oError) => {
                    debugger;
                    console.error("Fehler beim Aktualisieren der Menge:", oError);
                    MessageToast.show(oError);
                    checkIfAllDone();
                });
            });

        },
        

        /******************************************************
         * Private Methoden
         ******************************************************/

        /**
         * * Handler für die Route "Time".
         * * Diese Methode wird aufgerufen, wenn die Route "Time" aktiviert wird.
         * @param {sap.ui.base.Event} oEvent - Das Event-Objekt.
         * Enthält Informationen über die Route und die Parameter.
         * @private
         * @example
         * this.getRouter().getRoute("Time").attachPatternMatched(this._onObjectMatched, this);
         * @returns {void}
         * @throws {Error} Wenn keine gültige ServiceOrder gefunden wird.
         * @description
         * Lädt die ServiceOrder, ServiceOrderItems und zusätzliche Daten.
         * Setzt die ServiceOrder-ID in der View-Model.
         * Falls keine ServiceOrder gefunden wird, wird eine Fehlermeldung angezeigt.
         */
        _onObjectMatched: function (oEvent) {

            this._onResetUI();

            let sOrderId = oEvent.getParameter("arguments").serviceOrder;

            if (sOrderId) {
                this._loadServiceOrder(sOrderId);
                this._loadServiceOrderItems(sOrderId);
                this._loadAdditionalData(sOrderId);
                this._loadServiceConfirmationHeader(sOrderId);
                this._sOrderId = sOrderId;
            } else {
                MessageToast.show("Keine gültige ServiceOrder gefunden!");
                this._navBackOrHome("RouteMain");
            }
        },

        /**
         * @description
         * * Setzt die UI-Modelle zurück.
         * @private
         */
        _onResetUI: function () {
            // View-Modell filteredConfirmation
            const oFilteredModel = new JSONModel({
                serviceOrder: {},
                results: [],
                to_Item: [],
                additionalData: {},
                hasItems: false,
                hasSelectedItems: false,
                itemsCount: '0'
            });
            this.getView().setModel(oFilteredModel, "filteredConfirmation");

            // View-Modell serviceOrder
            const oServiceOrderModel = new JSONModel({
                to_Item: [],
                itemsCount: '0'
            });
            this.getView().setModel(oServiceOrderModel, "serviceOrder");

            // View-Modell UI 
            let oViewModel = new JSONModel({
                selectedTab: "orders", // Default to confirmations tab // orders we need as first
                busy: false,
                tableVisible: true,
                ExecutingServiceEmployee: this._i18n().getText("noEmployeeAssigned")
            });
            this.getView().setModel(oViewModel, "viewModel");
        },

        /**
         * @description
         * - returns the i18n resource bundle.
         * @private
         * @returns {sap.ui.core.resource.ResourceBundle}
         * - The i18n resource bundle.
         * @example
         * this._i18n().getText("key");
         */
        _i18n: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
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

        
        _switchTab: function (sTabName) {
            if(sTabName !== "orders" && sTabName !== "confirmations") {
                console.error("Invalid tab name:", sTabName);
                return;
            }
            
            const oViewModel = this.getView().getModel("viewModel");
            if (oViewModel) {
                oViewModel.setProperty("/selectedTab", sTabName);
                oViewModel.refresh(true);
                // if (sTabName === "orders") {
                //     this._loadServiceConfirmationItems(this._sOrderId);
                // }
            }
        },

        /**
         * * Führt den Batch-Submit durch und aktualisiert die Service Confirmation Items.
         * @param {sap.ui.model.odata.v2.ODataModel} oConfirmationModel - Das OData-Modell für die Service Confirmation.
         * @param {Array} mBatchOperations - Die Batch-Operationen, die ausgeführt werden sollen.
         * @param {string} sReferenceServiceOrder - Die Referenz-Service-Order.
         * @returns {void}
         * @private
         * @description
         * * Diese Methode führt den Batch-Submit durch und aktualisiert die Service Confirmation Items.
         * * Wenn keine Änderungen vorhanden sind, wird eine Nachricht angezeigt.
         * * Bei Erfolg wird eine Erfolgsmeldung angezeigt und die Service Confirmation neu geladen.
         * * Bei Fehlern wird eine Fehlermeldung angezeigt.
         * @example
         * this._submitBatch(oConfirmationModel, mBatchOperations, sReferenceServiceOrder);
         * @throws {Error} Wenn ein Fehler beim Speichern der Änderungen auftritt.
         */
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
        
        
        onReleaseOrderItemPress: function (oEvent) {
            const oCtx = oEvent.getSource().getBindingContext("serviceOrder");
            if (!oCtx) {
                return;
            }
            this._setBusy(true);
            
            const oServiceOrderModel = this.getView().getModel("serviceOrder");
            const oServiceOrderItem = oCtx.getObject();
            const sActionKey = this.serviceOrderItemActions.RELEASE;
            
            this._updateServiceOrderItem(oServiceOrderItem, sActionKey).then(() => {
                MessageToast.show(this._i18n().getText("releaseServiceOrderItemSuccess"));
                oServiceOrderItem.ServiceOrderItemIsReleased = "X";
                oServiceOrderItem.selected = false;
                
                oServiceOrderModel.refresh(true);
                
                this._setBusy(false);
                // this._loadServiceOrderItems(sServiceOrder);
            }).catch((oError) => {
                console.error("Fehler beim Aktualisieren der Service Order Item:", oError);
                MessageToast.show(this._i18n().getText("releaseServiceOrderItemError"));
            });
        },
        
        
        /**
         * @description
         * * Diese Methode aktualisiert den Service Order Item im Backend.
         * @example
         * this._updateServiceOrderItem(oItem, ServiceOrderItemActions.RELEASE);
         */
        _updateServiceOrderItem: function (oConfirmationItem, sActionKey) {
            const oServiceOrderModel = this.getOwnerComponent().getModel("serviceOrder");
            if (!oServiceOrderModel) {
                console.error(this._i18n().getText("modelNotFound", "serviceOrder"));
                return;
            }
        
            if (!sActionKey || !oConfirmationItem) {
                console.error("Fehlende Parameter für Update");
                return;
            }
        
            const sServiceOrder = oConfirmationItem.ServiceOrder;
            const sServiceOrderItem = oConfirmationItem.ServiceOrderItem;
            const sPath = `/A_ServiceOrderItem(ServiceOrder='${sServiceOrder}',ServiceOrderItem='${sServiceOrderItem}')`;
        
            const oPayload = {};
            oPayload[sActionKey] = "X";
        
            return new Promise((resolve, reject) => {
                oServiceOrderModel.update(sPath, oPayload, {
                    method: "PATCH",
                    success: resolve,
                    error: reject
                });
            });
        },

        _updateHasSelectedConfirmationItems: function () {
            const oFilteredModel = this.getView().getModel("filteredConfirmation");
            if (oFilteredModel) {
                const aItems = oFilteredModel.getProperty("/to_Item") || [];
                const bHasSelected = aItems.some(item => item.selected === true);
                oFilteredModel.setProperty("/hasSelectedItems", bHasSelected);
            }
        },

        _updateConfirmationItemQuantityToBackend: function (oConfirmationItem) {
            return new Promise((resolve, reject) => {

                debugger;
                if (String(oConfirmationItem.Quantity) == String(oConfirmationItem.backendQuantity)) {
                    return resolve(); // No update needed
                }

                const oConfirmationModel = this.getView().getModel("confirmation");
                const sServiceConfirmation = oConfirmationItem.ServiceConfirmation;
                const sServiceConfirmationItem = oConfirmationItem.ServiceConfirmationItem;
                const newQuantity = oConfirmationItem.Quantity;

                debugger;
                if (!sServiceConfirmation || !sServiceConfirmationItem || !newQuantity) {
                    debugger;
                    return reject(this._i18n().getText("updateServiceConfirmationItemMissingRequiredFields"));
                }
                
                const sPath = `/A_ServiceConfirmationItem(ServiceConfirmation='${sServiceConfirmation}',ServiceConfirmationItem='${sServiceConfirmationItem}')`;
                const oPayload = {
                    ExecutingServiceEmployee: "9980000012", // ToDo: delete this line and check earlier if employee is set
                    Quantity: newQuantity.toFixed(3), // Format to 3 decimal places as string
                };

                oConfirmationModel.update(sPath, oPayload, {
                    method: "PATCH",
                    success: (oData, response) => {
                        console.log("Update1:", oData, response);
                        resolve();
                    },
                    error: (oError) => {
                        debugger;
                        console.error("Update ServiceConfirmationItem error:", oError);
                        reject(this._i18n().getText("updateServiceConfirmationItemError"));
                    }
                });

            });

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
            const oViewModel = this.getView().getModel("viewModel");

            oODataModel.read("/A_ServiceOrderItem", {
                urlParameters: {
                    "$select": "ServiceOrder,ServiceOrderItemCategory,QuantityUnit,Quantity,ServiceOrderItemDescription,Product,ServiceOrderItem,ExecutingServiceEmployee,ServiceOrderItemIsReleased,ServiceOrderItemIsCompleted,ServiceOrderItemIsRejected",
                    "$filter": `(ServiceOrder eq '${sOrderId}') and (Product eq 'SRV_01')`
                },
                success: (oData) => {
                    const aProcessedItems = oData.results.map((item) => {
                        return {
                            ...item,
                            selected: false
                        };
                    });

                    oJSONModel.setProperty("/to_Item", aProcessedItems);
                    oJSONModel.setProperty("/hasItems", aProcessedItems.length > 0);
                    oJSONModel.setProperty("/itemsCount", aProcessedItems.length);
                    oJSONModel.refresh(true);

                    // Read and set employee name
                    if (oViewModel.getProperty("/ExecutingServiceEmployee") === this._i18n().getText("noEmployeeAssigned")) {
                        
                        const sEmployeeId = aProcessedItems.find(item => item.ExecutingServiceEmployee && item.ExecutingServiceEmployee !== "")?.ExecutingServiceEmployee;
                        this._getBusinessPartnerName(sEmployeeId).then((name) => oViewModel.setProperty("/ExecutingServiceEmployee", name));
                    }
                },
                error: (oError) => {
                    console.error("Error details:", oError);
                    // MessageToast.show("Error fetching service order items: " + oError.message);
                    oJSONModel.setProperty("/to_Item", []);
                    oJSONModel.refresh(true);
                }
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
                        // this._loadServiceConfirmation(sOrderId);
                        this._loadServiceConfirmationItems(sOrderId);
                        this._loadAdditionalData(sOrderId);
                    } else {
                        oFilteredModel.setProperty("/results", []);
                        oViewModel.setProperty("/tableVisible", false);
                        // MessageToast.show("Keine Service Confirmations gefunden!");
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

        _loadServiceConfirmationItems: function (sOrderId) {
            const oDataModel = this.getOwnerComponent().getModel("confirmation");
            const oFilteredConfirmationModel = this.getView().getModel("filteredConfirmation");
            const oViewModel = this.getView().getModel("viewModel");


            oDataModel.read("/A_ServiceConfirmationItem", {
                urlParameters: {
                    "$select": "ReferenceServiceOrder,ServiceConfirmation,ServiceConfirmationItem,Product,ServiceConfItemDescription,Quantity,QuantityUnit,ExecutingServiceEmployee,ActualServiceStartDateTime,ActualServiceEndDateTime,ServiceConfItemIsCompleted",
                    // "$filter": `(ReferenceServiceOrder eq '${sOrderId}') and (Product eq 'SRV_01')`
                    "$filter": `(ReferenceServiceOrder eq '${sOrderId}') and (Product eq 'SRV_01') and (ExecutingServiceEmployee eq '9980000012')`
                },
                success: (oData) => {
                    console.info(oData?.results);
                    if (oData?.results?.length) {
                        const aItems = oData.results.map((item) => {
                            return {
                                ...item,
                                selected: false,
                                backendQuantity: item.Quantity,
                                ActualServiceStartDateTime: item.ActualServiceStartDateTime || new Date().toISOString(),
                                ActualServiceEndDateTime: item.ActualServiceEndDateTime || new Date().toISOString(),
                            };
                        });

                        oFilteredConfirmationModel.setProperty("/to_Item", aItems);
                        oFilteredConfirmationModel.setProperty("/itemsCount", aItems.length);
                        oFilteredConfirmationModel.setProperty("/hasItems", aItems.length > 0);
                        oViewModel.setProperty("/tableVisible", aItems.length > 0);

                        if (oViewModel.getProperty("/ExecutingServiceEmployee") === this._i18n().getText("noEmployeeAssigned")) {
                            const sEmployeeId = aItems.find(item => item.ExecutingServiceEmployee && item.ExecutingServiceEmployee !== "")?.ExecutingServiceEmployee;
                            this._getBusinessPartnerName(sEmployeeId).then((name) => oViewModel.setProperty("/ExecutingServiceEmployee", name));
                        }
                    } else {
                        oFilteredConfirmationModel.setProperty("/to_Item", []);
                        oFilteredConfirmationModel.setProperty("/itemsCount", '0');
                        oFilteredConfirmationModel.setProperty("/hasItems", false);
                        oViewModel.setProperty("/tableVisible", false);
                    }
                },
                error: (oError) => {
                    console.error("Error details:", oError);
                    oFilteredConfirmationModel.setProperty("/to_Item", []);
                    oFilteredConfirmationModel.setProperty("/itemsCount", '0');
                    oFilteredConfirmationModel.setProperty("/hasItems", false);
                    oViewModel.setProperty("/tableVisible", false);
                }
            });
        },

        _loadAdditionalData: function (sOrderId) {
            const oMainModel = this.getView().getModel("YY1");
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

        _mapServiceConfirmationType: function (sFromType) {
            const oServiceTypeMap = {
                "SVO1": "SVC1",
                "SVO2": "SVC2",
                // "IN": "OUT"
            };
            return oServiceTypeMap[sFromType] || null;
        },

        _setBusy: function (bBusy) {
            const oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/busy", bBusy);
        },


        /**
         * @description
         * * Diese Methode liest den Namen des Geschäftspartners aus dem API OData-Modell.
         * * Wenn der Name nicht gefunden wird, wird eine Fehlermeldung zurückgegeben.
         * @param {string} sPartnerId - Die ID des Geschäftspartners.
         * @returns {Promise<string>} - Ein Promise, das den Namen des Geschäftspartners zurückgibt.
         * @private
         * @example
         * this._getBusinessPartnerName("12345").then(name => {
         *     console.log("Business Partner Name:", name);
         * });
         * @throws {Error} Wenn ein Fehler beim Laden der Daten auftritt.
         */
        _getBusinessPartnerName(sPartnerId) {
            if (!sPartnerId) {
                return new Promise((resolve) => resolve(this._i18n().getText("noEmployeeAssigned")));
            }

            const oBPModel = this.getOwnerComponent().getModel("businessPartner");

            return new Promise((resolve) => {
                oBPModel.read("/A_BusinessPartner('" + sPartnerId + "')", {
                    success: (oBPData) => resolve(oBPData?.BusinessPartnerName || sPartnerId),
                    error: () => resolve(this._i18n().getText("noEmployeeAssigned"))
                });
            });
        }

    });
});