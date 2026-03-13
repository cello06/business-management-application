sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/ui/core/mvc/XMLView",
  "hrproject/model/formatter",
  "sap/m/MessageToast"
], function (
  Controller,
  UIComponent,
  JSONModel,
  Filter,
  FilterOperator,
  XMLView,
  formatter,
  MessageToast
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
      console.log("1. onEmployeePress triggered");

      var oList = this.byId("employeeList");
      var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
      console.log("2. listItem:", oItem);

      var oCtx = oItem.getBindingContext();
      console.log("3. bindingContext:", oCtx);

      if (!oCtx) {
        console.log("4. No binding context, return");
        return;
      }

      var sPath = oCtx.getPath();
      console.log("5. context path:", sPath);

      var oSelectedItem = oList.getSelectedItem();
      console.log("6. selected item:", oSelectedItem);

      var oData = oCtx.getObject();
      console.log("7. selected object:", oData);

      console.log("8. this._sSectorId:", this._sSectorId);
      console.log("9. persId:", oData.PersId);

      console.log("10. BEFORE navTo");

      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: this._sSectorId,
        persId: oData.PersId
      });

      console.log("11. AFTER navTo");
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