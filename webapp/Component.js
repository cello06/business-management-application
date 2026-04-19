sap.ui.define([
        "sap/ui/core/UIComponent",
        "sap/ui/Device",
        "sap/ui/model/json/JSONModel",
        "hrproject/model/models"
    ],
    function (UIComponent, Device, JSONModel, models) {
        "use strict";

        return UIComponent.extend("hrproject.Component", {
            metadata: {
                manifest: "json"
            },

            init: function () {
                UIComponent.prototype.init.apply(this, arguments);

                this.getRouter().initialize();
                this.setModel(models.createDeviceModel(), "device");

                // Central user model — Home.controller populates this after
                // /UserRoles and /Employees resolve. Any controller can bind
                // to `user>/isLeader`, `user>/persId`, `user>/sectorId` etc.
                this.setModel(new JSONModel({
                    isLeader   : false,
                    isAdmin    : false,
                    roleLoaded : false,
                    persId     : "",
                    sapUsername: "",
                    sectorId   : "",
                    role       : ""
                }), "user");
            }
        });
    }
);
