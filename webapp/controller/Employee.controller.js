sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast",
  "hrproject/model/formatter"
], function (Controller, UIComponent, History, MessageToast, formatter) {
  "use strict";

  return Controller.extend("hrproject.controller.Employee", {
    formatter: formatter,

    onInit: function () {
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("RouteEmployee").attachPatternMatched(this._onRouteMatched, this);
    },
    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      this._sSectorId = oArgs.sectorId;

      var oList = this.byId("employeeList");
      var oBinding = oList.getBinding("items");

      if (oBinding) {
        oBinding.refresh();
      }
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteSectors");
    },
    onEmployeePress: function (oEvent) {
      var oList = this.byId("employeeList");
      var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
      var oCtx = oItem.getBindingContext();

      if (!oCtx) {
        return;
      }

      var sPath = oCtx.getPath();
      var oSelectedItem = oList.getSelectedItem();

      if (oSelectedItem && oSelectedItem.getBindingContext() &&
        oSelectedItem.getBindingContext().getPath() === sPath) {
        oList.removeSelections(true);
        return;
      }

      oList.setSelectedItem(oItem, true);

      var sPersId = oCtx.getProperty("PersId");

      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: this._sSectorId,
        persId: sPersId
      });
    },

    onCreateEmployee: function () {
      UIComponent.getRouterFor(this).navTo("RouteCreateEmployee", {
        sectorId: this._sSectorId
      });
    },



    onDeleteEmployee: function () {
      var oList = this.byId("employeeList");
      var oSelectedItem = oList.getSelectedItem();

      if (!oSelectedItem) {
        sap.m.MessageToast.show("Lütfen silmek için bir employee seçin.");
        return;
      }

      var oCtx = oSelectedItem.getBindingContext();
      var sPath = oCtx.getPath();
      var oModel = this.getView().getModel();

      sap.m.MessageBox.confirm("Selected employee will be deleted. Continue?", {
        actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
        onClose: function (sAction) {
          if (sAction === sap.m.MessageBox.Action.OK) {
            oModel.remove(sPath, {
              success: function () {
                sap.m.MessageToast.show("Employee deleted successfully.");
                oList.removeSelections(true);
                oList.getBinding("items").refresh();
              },
              error: function (oError) {
                var sMessage = "Employee could not be deleted.";

                try {
                  var oResponse = JSON.parse(oError.responseText);
                  sMessage = oResponse.error.message.value || sMessage;
                } catch (e) {
                  // default
                }

                sap.m.MessageBox.error(sMessage);
              }
            });
          }
        }
      });
    }
  });
});