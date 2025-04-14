sap.ui.define([
	'sap/ui/core/mvc/Controller',
	'sap/ui/model/json/JSONModel',
	'sap/m/p13n/Engine',
	'sap/m/p13n/SelectionController',
	'sap/m/p13n/SortController',
	'sap/m/p13n/GroupController',
	'sap/m/p13n/FilterController',
	'sap/m/p13n/MetadataHelper',
	'sap/ui/model/Sorter',
	'sap/m/ColumnListItem',
	'sap/m/Text',
	'sap/ui/core/library',
	'sap/m/table/ColumnWidthController',
	'sap/ui/model/Filter',
    'pho/com/serviceoverview/Formatter',
    "sap/m/MessageToast",
    "sap/m/MessageBox",
], function (Controller, JSONModel, Engine, SelectionController, SortController, GroupController, FilterController, MetadataHelper, Sorter,
    ColumnListItem, Text, coreLibrary, ColumnWidthController, Filter, Formatter, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("pho.com.serviceoverview.controller.Main", {
        formatter: Formatter,

        onInit: function () {
            this._oModel = null;

            const oServiceConfirmationModel = this.getOwnerComponent().getModel("YY1");
            oServiceConfirmationModel.read("/YY1_ServiceConfirmation", {
                success: (oData) => {
                    const seen = new Set();
                    const aUniqueItems = (oData?.results || []).filter(item => seen.has(item.ServiceOrder) ? false : seen.add(item.ServiceOrder));
                    const oNewData = {
                        items: aUniqueItems
                    };
                    const oModel = new JSONModel(oNewData);
                    this._oModel = oModel;
                    this.getView().setModel(oModel);
        
                    this._registerForP13n();
                },
                error: (oError) => {
                    console.error("Unite error:", oError);
                }
            });
        },

        _registerForP13n: function () {
            const oTable = this.byId("idServiceTable");

            this.oMetadataHelper = new MetadataHelper([
                {
                    key: "ServiceOrderDescription_col",
                    label: "Service Order Description",
                    path: "ServiceOrderDescription"
                },
                {
                    key: "ServiceOrder_col",
                    label: "Service Order",
                    path: "ServiceOrder"
                },
                {
                    key: "RequestedServiceStartDateTime_col",
                    label: "Start Date",
                    path: "RequestedServiceStartDateTime"
                },
                {
                    key: "RequestedServiceEndDateTime_col",
                    label: "End Date",
                    path: "RequestedServiceEndDateTime"
                },
                {
                    key: "ServiceOrderStatusName_col",
                    label: "Status",
                    path: "ServiceOrderStatusName"
                },
                {
                    key: "ServiceDocumentPriority_col",
                    label: "Priority",
                    path: "ServiceDocumentPriority"
                }
            ]);
            
			Engine.getInstance().register(oTable, {
				helper: this.oMetadataHelper,
				controller: {
					Columns: new SelectionController({
						targetAggregation: "columns",
						control: oTable
					}),
					Sorter: new SortController({
						control: oTable
					}),
					Groups: new GroupController({
						control: oTable
					}),
					ColumnWidth: new ColumnWidthController({
						control: oTable
					}),
					Filter: new FilterController({
						control: oTable
					})
				}
			});

			Engine.getInstance().attachStateChange(this.handleStateChange.bind(this));
		},

		handleStateChange: function(oEvt) {
			const oTable = this.byId("idServiceTable");
			const oState = oEvt.getParameter("state");

			if (!oState) {
				return;
			}

			//Update the columns per selection in the state
			this.updateColumns(oState);

			//Create Filters & Sorters
			const aFilter = this.createFilters(oState);
			const aGroups = this.createGroups(oState);
			const aSorter = this.createSorters(oState, aGroups);

			const aCells = oState.Columns.map(function(oColumnState) {
				return new Text({
					text: "{" + this.oMetadataHelper.getProperty(oColumnState.key).path + "}"
				});
			}.bind(this));

			//rebind the table with the updated cell template
			oTable.bindItems({
				templateShareable: false,
				path: '/items',
				sorter: aSorter.concat(aGroups),
				filters: aFilter,
				template: new ColumnListItem({
					cells: aCells
				})
			});

		},

		createFilters: function(oState) {
			const aFilter = [];
			Object.keys(oState.Filter).forEach((sFilterKey) => {
				const filterPath = this.oMetadataHelper.getProperty(sFilterKey).path;

				oState.Filter[sFilterKey].forEach(function(oConditon) {
					aFilter.push(new Filter(filterPath, oConditon.operator, oConditon.values[0]));
				});
			});

			this.byId("filterInfo").setVisible(aFilter.length > 0);

			return aFilter;
		},

		createSorters: function(oState, aExistingSorter) {
			const aSorter = aExistingSorter || [];
			oState.Sorter.forEach(function(oSorter) {
				const oExistingSorter = aSorter.find(function(oSort) {
					return oSort.sPath === this.oMetadataHelper.getProperty(oSorter.key).path;
				}.bind(this));

				if (oExistingSorter) {
					oExistingSorter.bDescending = !!oSorter.descending;
				} else {
					aSorter.push(new Sorter(this.oMetadataHelper.getProperty(oSorter.key).path, oSorter.descending));
				}
			}.bind(this));

			oState.Sorter.forEach((oSorter) => {
				const oCol = this.byId("idServiceTable").getColumns().find((oColumn) => oColumn.data("p13nKey") === oSorter.key);
				if (oSorter.sorted !== false) {
					oCol.setSortIndicator(oSorter.descending ? coreLibrary.SortOrder.Descending : coreLibrary.SortOrder.Ascending);
				}
			});

			return aSorter;
		},

		createGroups: function(oState) {
			const aGroupings = [];
			oState.Groups.forEach(function(oGroup) {
				aGroupings.push(new Sorter(this.oMetadataHelper.getProperty(oGroup.key).path, false, true));
			}.bind(this));

			oState.Groups.forEach((oSorter) => {
				const oCol = this.byId("idServiceTable").getColumns().find((oColumn) => oColumn.data("p13nKey") === oSorter.key);
				oCol.data("grouped", true);
			});

			return aGroupings;
		},

        openConfDialog: function (oEvt) {
			this._openConfDialog(["Columns", "Sorter", "Groups", "Filter"], oEvt.getSource());
			// this._openConfDialog(["Sorter", "Filter", "Groups"], oEvt.getSource());
        },

		_openConfDialog: function(aPanels, oSource) {
			var oTable = this.byId("idServiceTable");

			Engine.getInstance().show(oTable, aPanels, {
				contentHeight: aPanels.length > 1 ? "50rem" : "35rem",
				contentWidth: aPanels.length > 1 ? "45rem" : "32rem",
				source: oSource || oTable
			});
		},

		_getKey: function(oControl) {
			return oControl.data("p13nKey");
		},

		onClearFilterPress: function(oEvt) {
			const oTable = this.byId("idServiceTable");
			Engine.getInstance().retrieveState(oTable).then(function(oState) {
				for (var sKey in oState.Filter) {
					oState.Filter[sKey].map((condition) => {
						condition.filtered = false;
					});
				}
				Engine.getInstance().applyState(oTable, oState);
			});
		},

		updateColumns: function(oState) {
			const oTable = this.byId("idServiceTable");

			oTable.getColumns().forEach((oColumn, iIndex) => {
                oColumn.setVisible(false);
				oColumn.setWidth(oState.ColumnWidth[this._getKey(oColumn)]);
				oColumn.setSortIndicator(coreLibrary.SortOrder.None);
				oColumn.data("grouped", false);
			});

			oState.Columns.forEach((oProp, iIndex) => {
				const oCol = oTable.getColumns().find((oColumn) => oColumn.data("p13nKey") === oProp.key);
				oCol.setVisible(true);

				oTable.removeColumn(oCol);
				oTable.insertColumn(oCol, iIndex);
			});
		},

		beforeOpenColumnMenu: function(oEvt) {
			const oMenu = this.byId("menu");
			const oColumn = oEvt.getParameter("openBy");
			const oSortItem = oMenu.getQuickActions()[0].getItems()[0];
			const oGroupItem = oMenu.getQuickActions()[1].getItems()[0];

			oSortItem.setKey(this._getKey(oColumn));
			oSortItem.setLabel(oColumn.getHeader().getText());
			oSortItem.setSortOrder(oColumn.getSortIndicator());

			oGroupItem.setKey(this._getKey(oColumn));
			oGroupItem.setLabel(oColumn.getHeader().getText());
			oGroupItem.setGrouped(oColumn.data("grouped"));
		},

		onFilterInfoPress: function(oEvt) {
			this._openConfDialog(["Filter"], oEvt.getSource());
		},

		onSort: function(oEvt) {
			const oSortItem = oEvt.getParameter("item");
			const oTable = this.byId("idServiceTable");
			const sAffectedProperty = oSortItem.getKey();
			const sSortOrder = oSortItem.getSortOrder();

			//Apply the state programatically on sorting through the column menu
			//1) Retrieve the current personalization state
			Engine.getInstance().retrieveState(oTable).then(function(oState) {

				//2) Modify the existing personalization state --> clear all sorters before
				oState.Sorter.forEach(function(oSorter) {
					oSorter.sorted = false;
				});

				if (sSortOrder !== coreLibrary.SortOrder.None) {
					oState.Sorter.push({
						key: sAffectedProperty,
						descending: sSortOrder === coreLibrary.SortOrder.Descending
					});
				}

				//3) Apply the modified personalization state to persist it in the VariantManagement
				Engine.getInstance().applyState(oTable, oState);
			});
		},

		onGroup: function(oEvt) {
			const oGroupItem = oEvt.getParameter("item");
			const oTable = this.byId("idServiceTable");
			const sAffectedProperty = oGroupItem.getKey();

			//1) Retrieve the current personalization state
			Engine.getInstance().retrieveState(oTable).then(function(oState) {

				//2) Modify the existing personalization state --> clear all groupings before
				oState.Groups.forEach(function(oSorter) {
					oSorter.grouped = false;
				});

				if (oGroupItem.getGrouped()) {
					oState.Groups.push({
						key: sAffectedProperty
					});
				}

				//3) Apply the modified personalization state to persist it in the VariantManagement
				Engine.getInstance().applyState(oTable, oState);
			});
        },
        
		onColumnMove: function(oEvt) {
			const oDraggedColumn = oEvt.getParameter("draggedControl");
			const oDroppedColumn = oEvt.getParameter("droppedControl");

			if (oDraggedColumn === oDroppedColumn) {
				return;
			}

			const oTable = this.byId("idServiceTable");
			const sDropPosition = oEvt.getParameter("dropPosition");
			const iDraggedIndex = oTable.indexOfColumn(oDraggedColumn);
			const iDroppedIndex = oTable.indexOfColumn(oDroppedColumn);
			const iNewPos = iDroppedIndex + (sDropPosition == "Before" ? 0 : 1) + (iDraggedIndex < iDroppedIndex ? -1 : 0);
			const sKey = this._getKey(oDraggedColumn);

			Engine.getInstance().retrieveState(oTable).then(function(oState) {

				const oCol = oState.Columns.find(function(oColumn) {
					return oColumn.key === sKey;
				}) || {
					key: sKey
				};
				oCol.position = iNewPos;

				Engine.getInstance().applyState(oTable, {
					Columns: [oCol]
				});
			});
		},

		onClearFilterPress: function(oEvt) {
			const oTable = this.byId("idServiceTable");
			Engine.getInstance().retrieveState(oTable).then(function(oState) {
				for (var sKey in oState.Filter) {
					oState.Filter[sKey].map((condition) => {
						condition.filtered = false;
					});
				}
				Engine.getInstance().applyState(oTable, oState);
			});
		},

		onColumnResize: function(oEvt) {
			const oColumn = oEvt.getParameter("column");
			const sWidth = oEvt.getParameter("width");
			const oTable = this.byId("idServiceTable");

			const oColumnState = {};
			oColumnState[this._getKey(oColumn)] = sWidth;

			Engine.getInstance().applyState(oTable, {
				ColumnWidth: oColumnState
			});
		},
        
        onServiceOrderPress: function (oEvt) {
            let oRouter = this.getOwnerComponent().getRouter();
            let oItem = oEvt.getSource();
            let oContext = oItem.getBindingContext();
            debugger;
            if (oContext) {
                let sOrderId = oContext.getProperty("ServiceOrder");
                console.log("Service Order ID:", sOrderId);
                oRouter.navTo("Time", { serviceOrder: sOrderId });
            } else {
                MessageToast.show("Keine ServiceOrder gefunden!");
            }
        },


        /**
         * @description
         * Diese Methode liest den Namen des Geschäftspartners aus dem API OData-Modell.
         * @param {string} sPartnerId - Die ID des Geschäftspartners.
         * @returns {Promise<string>} - Ein Promise, das den Namen des Geschäftspartners zurückgibt.
         * @private
         * @example
         * this._getBusinessPartnerName("12345").then(name => {
         *     console.log("Business Partner Name:", name);
         * });
         * @throws {NoError} - Wenn der Name nicht gefunden wird, wird ein noEmployeeAssigned-Text als resolve zurückgegeben (nicht als Fehler)
         */        
        _getBusinessPartnerName(sPartnerId) {
            return new Promise((resolve, reject) => {
                if (!sPartnerId) {
                    resolve(this._i18n().getText("noEmployeeAssigned"));
                } else {
                    const oBPModel = this.getOwnerComponent().getModel("businessPartner");
                    oBPModel.read("/A_BusinessPartner('" + sPartnerId + "')", {
                        success: (oBPData) => resolve(oBPData?.BusinessPartnerName || sPartnerId),
                        error: () => resolve(this._i18n().getText("noEmployeeAssigned"))
                    });
                }
            });
        }
        
    });
});