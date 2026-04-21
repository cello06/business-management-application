sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "hrproject/model/formatter",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (
  Controller,
  UIComponent,
  Filter,
  FilterOperator,
  formatter,
  MessageToast,
  MessageBox
) {
  "use strict";

  return Controller.extend("hrproject.controller.Employee", {
    formatter: formatter,

    onInit: function () {
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("RouteEmployee").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      this._sTeamId = oArgs.sectorId;

      var oList = this.byId("employeeList");
      var oBinding = oList.getBinding("items");

      if (oBinding) {
        var oFilter = new Filter("TeamId", FilterOperator.EQ, this._sTeamId);
        oBinding.filter([oFilter]);
      }

      var oModel = this.getView().getModel();
      var oText = this.byId("sectorInfoText");

      oModel.read("/Sectors(" + this._sTeamId + ")", {
        success: function (oData) {
          oText.setText(oData.SectorName);
        },
        error: function () {
          oText.setText("");
        }
      });
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteSectors");
    },

    onEmployeePress: function (oEvent) {
      var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
      var oCtx = oItem.getBindingContext();

      if (!oCtx) {
        return;
      }

      var oData = oCtx.getObject();

      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: this._sTeamId,
        persId: oData.PersId
      });
    },

    onCreateEmployee: function () {
      UIComponent.getRouterFor(this).navTo("RouteCreateEmployee", {
        sectorId: this._sTeamId
      });
    },

    onDeleteEmployee: function () {
      var oList = this.byId("employeeList");
      var aSelectedItems = oList.getSelectedItems();

      if (!aSelectedItems.length) {
        MessageToast.show("Lütfen silmek için en az bir employee seçin.");
        return;
      }

      var oModel = this.getView().getModel();

      MessageBox.confirm("Selected employee(s) will be deleted. Continue?", {
        actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            aSelectedItems.forEach(function (oItem) {
              var sPath = oItem.getBindingContext().getPath();
              oModel.remove(sPath);
            });

            MessageToast.show("Employee deleted successfully.");
            oList.removeSelections(true);
            oList.getBinding("items").refresh();
          }
        }
      });
    }
  });
});