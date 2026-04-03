sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, History) {
    "use strict";

    return Controller.extend("hrproject.controller.myProjects.MyProjects", {

        onInit: function () {
            var oModel = new JSONModel({
                ongoingCount:  0,
                finishedCount: 0,
                allCount:      0
            });
            this.getView().setModel(oModel, "myProjects");

            this.getOwnerComponent()
                .getRouter()
                .getRoute("RouteMyProjects")
                .attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            // PersId comes directly from route — same as MyCourses
            this._sPersId = oEvent.getParameter("arguments").persId;
            this._loadCounts();
        },

        _loadCounts: function () {
            var oODataModel = this.getOwnerComponent().getModel();
            var oViewModel  = this.getView().getModel("myProjects");
            var sPersId     = this._sPersId;

            // Ongoing: ActiveProject = true — same $filter style as MyCourses
            oODataModel.read("/PersonProjects/$count", {
                urlParameters: {
                    "$filter": "PersId eq '" + sPersId + "' and ActiveProject eq true"
                },
                success: function (oData) {
                    oViewModel.setProperty("/ongoingCount", parseInt(oData, 10) || 0);
                }
            });

            // Finished: ActiveProject = false
            oODataModel.read("/PersonProjects/$count", {
                urlParameters: {
                    "$filter": "PersId eq '" + sPersId + "' and ActiveProject eq false"
                },
                success: function (oData) {
                    oViewModel.setProperty("/finishedCount", parseInt(oData, 10) || 0);
                }
            });

            // All company projects — from /Projects entity
            oODataModel.read("/Projects/$count", {
                success: function (oData) {
                    oViewModel.setProperty("/allCount", parseInt(oData, 10) || 0);
                }
            });
        },

        onTilePress: function (oEvent) {
            var sType = oEvent.getSource().data("type");
            this.getOwnerComponent().getRouter().navTo("RouteProjectList", {
                persId: this._sPersId,
                type:   sType
            });
        },

        onNavBack: function () {
            // Always go directly to Home — same as MyCourses pattern
            this.getOwnerComponent().getRouter().navTo("RouteHome", {}, true);
        }
    });
});