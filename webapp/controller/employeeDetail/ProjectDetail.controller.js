sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/UIComponent",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageBox"
], function (Controller, UIComponent, JSONModel, MessageBox) {
  "use strict";

  return Controller.extend("hrproject.controller.employeeDetail.ProjectDetail", {
    onInit: function () {
      var oDetailModel = new JSONModel({
        ProjectId: "",
        ProjectName: "",
        ProjectDesc: "",
        ProjectCategory: "",
        Status: "",
        Priority: "",
        AssignedDate: "",
        RoleInProject: "",
        HoursAllocated: 0,
        HoursSpent: 0,
        RemainingHours: 0,
        ProgressPercent: 0,
        ProgressState: "None",
        ActiveProject: false
      });

      this.getView().setModel(oDetailModel, "detail");

      UIComponent.getRouterFor(this)
        .getRoute("RouteProjectDetail")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments");

      this._sSectorId = oArgs.sectorId;
      this._sPersId = oArgs.persId;
      this._sProjectId = oArgs.projectId;

      this._loadProjectDetail(this._sPersId, this._sProjectId);
    },

    _loadProjectDetail: function (sPersId, sProjectId) {
      var oModel = this.getOwnerComponent().getModel();
      var oDetailModel = this.getView().getModel("detail");
      var sPath = "/EmployeeProjectDetails(PersId='" + sPersId + "',ProjectId=" + sProjectId + ")";

      this.getView().setBusy(true);

      oModel.read(sPath, {
        success: function (oData) {
          var iAllocated = Number(oData.HoursAllocated || 0);
          var iSpent = Number(oData.HoursSpent || 0);
          var iRemaining = Math.max(0, iAllocated - iSpent);
          var fPercent = iAllocated > 0 ? (iSpent / iAllocated) * 100 : 0;

          var sProgressState = "Error";
          if (fPercent >= 100) {
            sProgressState = "Success";
          } else if (fPercent >= 50) {
            sProgressState = "Warning";
          }

          oDetailModel.setData({
            ProjectId: oData.ProjectId,
            ProjectName: oData.ProjectName || "",
            ProjectDesc: oData.ProjectDesc || "",
            ProjectCategory: oData.ProjectCategory || "",
            Status: oData.Status || "",
            Priority: oData.Priority || "",
            AssignedDate: oData.AssignedDate || "",
            RoleInProject: oData.RoleInProject || "",
            HoursAllocated: iAllocated,
            HoursSpent: iSpent,
            RemainingHours: iRemaining,
            ProgressPercent: Number(fPercent.toFixed(1)),
            ProgressState: sProgressState,
            ActiveProject: !!oData.ActiveProject
          });

          this.getView().setBusy(false);
        }.bind(this),

        error: function (oError) {
          this.getView().setBusy(false);
          console.error("Project detail read error:", oError);
          MessageBox.error("Project detail could not be loaded.");
        }.bind(this)
      });
    },

    onNavBack: function () {
      UIComponent.getRouterFor(this).navTo("RouteEmployeeDetail", {
        sectorId: this._sSectorId,
        persId: this._sPersId
      });
    }
  });
});