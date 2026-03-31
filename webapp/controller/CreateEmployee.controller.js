sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/core/routing/History",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, UIComponent, History, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("hrproject.controller.CreateEmployee", {

    onInit: function () {
      var oRouter = UIComponent.getRouterFor(this);
      oRouter.getRoute("RouteCreateEmployee").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");
      this._sSectorId = oArgs.sectorId;
      this.byId("inpSectorId").setValue(this._sSectorId);

      this._clearForm();
    },

    _clearForm: function () {
      this.byId("inpPersId").setValue("");
      this.byId("inpFirstName").setValue("");
      this.byId("inpLastName").setValue("");
      this.byId("inpTitle").setValue("");
      this.byId("inpPersId").setValueState("None");
      this.byId("inpPersId").setValueStateText("");
    },

    onPersIdLiveChange: function (oEvent) {
      var oInput = oEvent.getSource();
      var sValue = oInput.getValue();

      sValue = sValue.replace(/\D/g, "").slice(0, 11);
      oInput.setValue(sValue);

      if (!sValue) {
        oInput.setValueState("None");
        oInput.setValueStateText("");
        return;
      }

      if (sValue.length < 11) {
        oInput.setValueState("Warning");
        oInput.setValueStateText("TC ID must be exactly 11 digits.");
      } else {
        oInput.setValueState("Success");
        oInput.setValueStateText("");
      }
    },

    _isValidTcId: function (sTcId) {
      return /^\d{11}$/.test(sTcId);
    },

    onSave: function () {
      var oModel = this.getView().getModel();
      var oPersIdInput = this.byId("inpPersId");
      var sSalary = this.byId("inpSalary").getValue();
      var sSalary = this.byId("inpSalary").getValue().trim().replace(",", ".");

      var oPayload = {
        PersId: oPersIdInput.getValue().trim(),
        FirstName: this.byId("inpFirstName").getValue().trim(),
        LastName: this.byId("inpLastName").getValue().trim(),
        Title: this.byId("inpTitle").getValue().trim(),
        Salary: sSalary ? sSalary : "0.00",
        SectorId: parseInt(this.byId("inpSectorId").getValue(), 10)
      };

      if (!oPayload.PersId || !oPayload.FirstName || !oPayload.LastName || !oPayload.SectorId) {
        MessageToast.show("TC ID, First Name, Last Name ve Sector ID zorunlu.");
        return;
      }

      if (!this._isValidTcId(oPayload.PersId)) {
        oPersIdInput.setValueState("Error");
        oPersIdInput.setValueStateText("TC ID must be numeric and exactly 11 digits.");
        MessageToast.show("TC ID must be numeric and exactly 11 digits.");
        return;
      }

      oPersIdInput.setValueState("None");
      oPersIdInput.setValueStateText("");

      oModel.create("/Employees", oPayload, {
        success: function () {
          MessageToast.show("Employee created successfully.");
          window.history.go(-1);
        },
        error: function (oError) {
          var sMessage = "Employee could not be created.";

          try {
            var oResponse = JSON.parse(oError.responseText);
            sMessage = oResponse.error.message.value || sMessage;
          } catch (e) {
            // default
          }

          MessageBox.error(sMessage);
        }
      });
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteEmployee", {
        sectorId: this._sSectorId
      });
    }
  });
});