sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/m/MessageToast",
  "sap/m/MessageBox",
  "sap/m/CustomListItem",
  "sap/ui/model/json/JSONModel"
], function (Controller, Fragment, MessageToast, MessageBox, CustomListItem, JSONModel) {
  "use strict";

  var mListStatus = {
    "backlogList": "BACKLOG",
    "todoList": "TODO",
    "inProgressList": "IN_PROGRESS",
    "testList": "TEST",
    "completedList": "COMPLETED"
  };

  var mListCount = {
    "backlogList": "backlogCount",
    "todoList": "todoCount",
    "inProgressList": "inProgressCount",
    "testList": "testCount",
    "completedList": "completedCount"
  };

  var mListPath = {
    "backlogList": "/backlog",
    "todoList": "/todo",
    "inProgressList": "/inProgress",
    "testList": "/test",
    "completedList": "/completed"
  };

  return Controller.extend("hrproject.controller.dailyActivities.DailyActivities", {

    onInit: function () {
      var oKanbanModel = new JSONModel({
        backlog: [],
        todo: [],
        inProgress: [],
        test: [],
        completed: [],
        backlogVisible: false
      });
      this.getView().setModel(oKanbanModel, "kanban");

      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteDailyActivities")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    // ── Route matched ──────────────────────────────────────────────────────
    _onRouteMatched: function (oEvent) {
      var oComp = this.getOwnerComponent();

      this._sPersId = oEvent.getParameter("arguments").persId;

      this._sSapUsername = oComp._sSapUsername || "";
      if (!this._sSapUsername) {
        try {
          var oHomeModel = oComp.getModel("home");
          if (oHomeModel) {
            this._sSapUsername = oHomeModel.getProperty("/sapUsername") || "";
          }
        } catch (e) { /* ignore */ }
      }

      if (!this._sSapUsername) {
        this._lookupSapUsername();
      }

      this._bEditMode = false;
      this._editTaskId = null;

      console.log("DailyActivities → persId:", this._sPersId, "| username:", this._sSapUsername);

      this._loadAllColumns();
    },

    // ── Fallback: lookup SapUsername ───────────────────────────────────────
    _lookupSapUsername: function () {
      var oModel = this.getView().getModel();
      var sPersId = this._sPersId;
      var that = this;

      oModel.read("/Employees", {
        urlParameters: {
          "$filter": "PersId eq '" + sPersId + "'",
          "$select": "SapUsername",
          "$top": "1"
        },
        success: function (oData) {
          if (oData.results && oData.results.length > 0) {
            that._sSapUsername = oData.results[0].SapUsername || "";
            console.log("SapUsername resolved:", that._sSapUsername);
          }
        }
      });
    },

    // ── Date helpers ───────────────────────────────────────────────────────
    // OData v2 date format: /Date(milliseconds)/
    _getTodayOData: function () {
      var oNow = new Date();
      // Use UTC date to avoid timezone shift
      var oUTC = Date.UTC(
        oNow.getFullYear(),
        oNow.getMonth(),
        oNow.getDate()
      );
      return "/Date(" + oUTC + ")/";
    },

    // ── Next TaskId ────────────────────────────────────────────────────────
    _getNextTaskId: function (fnCallback) {
      var oModel = this.getView().getModel();
      oModel.read("/DailyTasks", {
        urlParameters: {
          "$select": "TaskId",
          "$orderby": "TaskId desc",
          "$top": "1"
        },
        success: function (oData) {
          var iMax = 0;
          if (oData.results && oData.results.length > 0) {
            iMax = parseInt(oData.results[0].TaskId, 10) || 0;
          }
          fnCallback((iMax + 1).toString());
        },
        error: function () {
          fnCallback(Date.now().toString().slice(-10));
        }
      });
    },

    // ── Load all columns ───────────────────────────────────────────────────
    _loadAllColumns: function () {
      var oModel = this.getView().getModel();
      var oKanbanModel = this.getView().getModel("kanban");
      var sPersId = this._sPersId;
      var that = this;

      // Backlog — global, no PersId filter
      oModel.read("/DailyTasks", {
        urlParameters: { "$filter": "Status eq 'BACKLOG'" },
        success: function (oData) {
          oKanbanModel.setProperty("/backlog", oData.results);
          var iCount = oData.results.length;
          var oBtn = that.byId("backlogToggleBtn");
          if (oBtn) { oBtn.setText("Backlog (" + iCount + ")"); }
          var oCountCtrl = that.byId("backlogCount");
          if (oCountCtrl) { oCountCtrl.setText(iCount.toString()); }
        },
        error: function (oErr) {
          console.error("Backlog load failed:", oErr && oErr.responseText);
        }
      });

      // Kanban columns — filtered by PersId
      ["todoList", "inProgressList", "testList", "completedList"].forEach(function (sListId) {
        var sStatus = mListStatus[sListId];
        var sPath = mListPath[sListId];

        oModel.read("/DailyTasks", {
          urlParameters: {
            "$filter": "PersId eq '" + sPersId + "' and Status eq '" + sStatus + "'"
          },
          success: function (oData) {
            oKanbanModel.setProperty(sPath, oData.results);
          },
          error: function (oErr) {
            console.error("Load failed:", sStatus, oErr && oErr.responseText);
          }
        });
      });

      this._loadKanbanCounts();
    },

    _loadKanbanCounts: function () {
      var oModel = this.getView().getModel();
      var sPersId = this._sPersId;
      var that = this;

      ["todoList", "inProgressList", "testList", "completedList"].forEach(function (sListId) {
        var sStatus = mListStatus[sListId];
        var oCountCtrl = that.byId(mListCount[sListId]);

        oModel.read("/DailyTasks/$count", {
          urlParameters: {
            "$filter": "PersId eq '" + sPersId + "' and Status eq '" + sStatus + "'"
          },
          success: function (oData) {
            if (oCountCtrl) {
              oCountCtrl.setText((parseInt(oData, 10) || 0).toString());
            }
          }
        });
      });
    },

    _refreshAllLists: function () {
      this._loadAllColumns();
    },

    // ── Navigation ─────────────────────────────────────────────────────────
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteHome");
    },

    // ── Backlog toggle ─────────────────────────────────────────────────────
    onToggleBacklog: function () {
      var oKanbanModel = this.getView().getModel("kanban");
      var bVisible = oKanbanModel.getProperty("/backlogVisible");
      oKanbanModel.setProperty("/backlogVisible", !bVisible);
    },

    // ── Assign task to self ────────────────────────────────────────────────
    onAssignTask: function (oEvent) {
      // Walk up parent chain to find CustomListItem (safer than fixed levels)
      var oControl = oEvent.getSource();
      var oItem = null;
      var iMax = 10;
      while (oControl && iMax > 0) {
        if (oControl.isA && oControl.isA("sap.m.CustomListItem")) {
          oItem = oControl;
          break;
        }
        oControl = oControl.getParent();
        iMax--;
      }
      var oCtx = oItem ? oItem.getBindingContext("kanban") : null;

      if (!oCtx) {
        console.error("onAssignTask: no kanban binding context");
        return;
      }

      var sTaskId = oCtx.getProperty("TaskId");
      var sTitle = oCtx.getProperty("Title");
      var sToday = this._getTodayOData();
      var sPersId = this._sPersId;
      var sSapUsername = this._sSapUsername;
      var that = this;

      console.log("Assigning task:", sTaskId, "to PersId:", sPersId, "username:", sSapUsername);

      if (!sPersId || !sSapUsername) {
        MessageBox.error("Could not resolve your user profile. Please go back to home and try again.");
        return;
      }

      MessageBox.confirm(
        "Assign task \"" + sTitle + "\" to yourself?\n\nIt will move to your To Do column.",
        {
          title: "Confirm Assignment",
          emphasizedAction: MessageBox.Action.OK,
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.OK) {
              var oModel = that.getView().getModel();

              // Build update payload — only send fields that need to change
              var oPayload = {
                PersId: sPersId,
                SapUsername: sSapUsername,
                AssignedBy: sSapUsername,
                AssignedDate: sToday,
                Status: "TODO"
              };

              console.log("Assign payload:", JSON.stringify(oPayload));

              oModel.update("/DailyTasks('" + sTaskId + "')", oPayload, {
                success: function () {
                  // Show success message with task name
                  MessageBox.success(
                    "Task \"" + sTitle + "\" has been assigned to you!\n\nCheck your To Do column.",
                    {
                      title: "Task Assigned",
                      onClose: function () {
                        that._refreshAllLists();
                      }
                    }
                  );
                },
                error: function (oErr) {
                  var sMsg = "Failed to assign task.";
                  try {
                    var oResp = JSON.parse(oErr.responseText);
                    sMsg = oResp.error.message.value || sMsg;
                  } catch (e) { }
                  console.error("Assign failed:", oErr && oErr.responseText);
                  MessageBox.error(sMsg);
                }
              });
            }
          }
        }
      );
    },

    // ── Drag & Drop ────────────────────────────────────────────────────────
    onDrop: function (oEvent) {
      var oDraggedItem = oEvent.getParameter("draggedControl");
      var oDroppedItem = oEvent.getParameter("droppedControl");

      var oDraggedCtx = oDraggedItem
        ? oDraggedItem.getBindingContext("kanban")
        : null;

      if (!oDraggedCtx) { return; }

      var sTaskId = oDraggedCtx.getProperty("TaskId");
      var sOldStatus = oDraggedCtx.getProperty("Status");

      var oTargetList = null;
      if (oDroppedItem instanceof CustomListItem) {
        oTargetList = oDroppedItem.getParent();
      } else if (oDroppedItem && oDroppedItem.isA("sap.m.List")) {
        oTargetList = oDroppedItem;
      } else {
        var oParent = oDroppedItem && oDroppedItem.getParent ? oDroppedItem.getParent() : null;
        while (oParent) {
          if (oParent.isA && oParent.isA("sap.m.List")) { oTargetList = oParent; break; }
          oParent = oParent.getParent ? oParent.getParent() : null;
        }
      }

      if (!oTargetList) { return; }

      var sNewStatus = null;
      var sTargetId = oTargetList.getId();
      Object.keys(mListStatus).forEach(function (sLocalId) {
        if (sTargetId === sLocalId || sTargetId.endsWith("--" + sLocalId)) {
          sNewStatus = mListStatus[sLocalId];
        }
      });

      if (!sNewStatus || sOldStatus === sNewStatus) { return; }

      // If dragging FROM backlog TO kanban → auto-assign
      var oUpdatePayload = { Status: sNewStatus };
      if (sOldStatus === "BACKLOG" && sNewStatus !== "BACKLOG") {
        var sToday = this._getTodayOData();
        oUpdatePayload.PersId = this._sPersId;
        oUpdatePayload.SapUsername = this._sSapUsername;
        oUpdatePayload.AssignedBy = this._sSapUsername;
        oUpdatePayload.AssignedDate = sToday;
      }

      var oModel = this.getView().getModel();
      oModel.update("/DailyTasks('" + sTaskId + "')", oUpdatePayload, {
        success: function () {
          MessageToast.show("Moved to: " + sNewStatus.replace(/_/g, " "));
          this._refreshAllLists();
        }.bind(this),
        error: function (oErr) {
          console.error("Drop failed:", oErr && oErr.responseText);
          MessageBox.error("Failed to update task status.");
        }
      });
    },

    // ── Dialog ─────────────────────────────────────────────────────────────
    _openDialog: function (fnAfterOpen) {
      if (!this._oCreateDialog) {
        Fragment.load({
          id: this.getView().getId(),
          name: "hrproject.view.dailyActivities.CreateTaskDialog",
          controller: this
        }).then(function (oDialog) {
          this._oCreateDialog = oDialog;
          this.getView().addDependent(oDialog);
          fnAfterOpen();
          oDialog.open();
        }.bind(this));
      } else {
        fnAfterOpen();
        this._oCreateDialog.open();
      }
    },

    _getField: function (sId) {
      return this.byId(sId) ||
        sap.ui.getCore().byId(this.getView().getId() + "--" + sId);
    },

    _setFormValues: function (sTitle, sDesc, sStatus, iPoints) {
      if (this._getField("taskTitle")) { this._getField("taskTitle").setValue(sTitle); }
      if (this._getField("taskDesc")) { this._getField("taskDesc").setValue(sDesc); }
      if (this._getField("taskStatus")) { this._getField("taskStatus").setSelectedKey(sStatus); }
      if (this._getField("taskPoints")) { this._getField("taskPoints").setValue(iPoints); }
    },

    // ── Create ─────────────────────────────────────────────────────────────
    onCreateTask: function () {
      this._bEditMode = false;
      this._editTaskId = null;
      this._openDialog(function () {
        this._oCreateDialog.setTitle("New Task");
        this._setFormValues("", "", "TODO", 10);
      }.bind(this));
    },

    // ── Edit ───────────────────────────────────────────────────────────────
    onEditTask: function (oEvent) {
      var oControl = oEvent.getSource();
      var oItem = null; var iMax = 10;
      while (oControl && iMax > 0) {
        if (oControl.isA && oControl.isA("sap.m.CustomListItem")) { oItem = oControl; break; }
        oControl = oControl.getParent(); iMax--;
      }
      var oCtx = oItem ? oItem.getBindingContext("kanban") : null;

      if (!oCtx) { return; }

      this._bEditMode = true;
      this._editTaskId = oCtx.getProperty("TaskId");

      this._openDialog(function () {
        this._oCreateDialog.setTitle("Edit Task");
        this._setFormValues(
          oCtx.getProperty("Title"),
          oCtx.getProperty("Description"),
          oCtx.getProperty("Status"),
          oCtx.getProperty("Points")
        );
      }.bind(this));
    },

    onSaveTask: function () {
      if (this._bEditMode && this._editTaskId) {
        this._updateTask();
      } else {
        this._createTask();
      }
    },

    // ── _createTask ────────────────────────────────────────────────────────
    _createTask: function () {
      var sTitle = this._getField("taskTitle") ? this._getField("taskTitle").getValue().trim() : "";
      var sDesc = this._getField("taskDesc") ? this._getField("taskDesc").getValue().trim() : "";
      var sStatus = this._getField("taskStatus") ? this._getField("taskStatus").getSelectedKey() : "TODO";
      var iPoints = this._getField("taskPoints") ? this._getField("taskPoints").getValue() : 10;

      if (!sTitle) { MessageToast.show("Please enter a task title."); return; }

      var that = this;
      var sToday = this._getTodayOData();
      var bBacklog = (sStatus === "BACKLOG");

      this._getNextTaskId(function (sTaskId) {
        var oPayload = {
          TaskId: sTaskId,
          PersId: bBacklog ? "" : that._sPersId,
          SapUsername: bBacklog ? "" : that._sSapUsername,
          Title: sTitle,
          Description: sDesc,
          Status: sStatus,
          Points: iPoints,
          BoardId: "0000000001",
          CreatedOn: sToday,
          ChangedOn: sToday,
          CreatedBy: that._sSapUsername
        };

        var oModel = that.getView().getModel();
        oModel.create("/DailyTasks", oPayload, {
          success: function () {
            MessageToast.show(bBacklog ? "Task added to Backlog!" : "Task created!");
            that._oCreateDialog.close();
            that._refreshAllLists();
          },
          error: function (oErr) {
            console.error("Create failed:", oErr && oErr.responseText);
            var sMsg = "Failed to create task.";
            try {
              var oResp = JSON.parse(oErr.responseText);
              sMsg = oResp.error.message.value || sMsg;
            } catch (e) { }
            MessageBox.error(sMsg);
          }
        });
      });
    },

    _updateTask: function () {
      var sTitle = this._getField("taskTitle") ? this._getField("taskTitle").getValue().trim() : "";
      var sDesc = this._getField("taskDesc") ? this._getField("taskDesc").getValue().trim() : "";
      var sStatus = this._getField("taskStatus") ? this._getField("taskStatus").getSelectedKey() : "TODO";
      var iPoints = this._getField("taskPoints") ? this._getField("taskPoints").getValue() : 10;

      if (!sTitle) { MessageToast.show("Please enter a task title."); return; }

      var oModel = this.getView().getModel();
      var sToday = this._getTodayOData();

      oModel.update("/DailyTasks('" + this._editTaskId + "')", {
        Title: sTitle,
        Description: sDesc,
        Status: sStatus,
        Points: iPoints,
        ChangedOn: sToday
      }, {
        success: function () {
          MessageToast.show("Task updated!");
          this._bEditMode = false;
          this._editTaskId = null;
          this._oCreateDialog.close();
          this._refreshAllLists();
        }.bind(this),
        error: function (oErr) {
          console.error("Update failed:", oErr && oErr.responseText);
          MessageBox.error("Failed to update task.");
        }
      });
    },

    onCancelTask: function () {
      if (this._oCreateDialog) { this._oCreateDialog.close(); }
      this._bEditMode = false;
      this._editTaskId = null;
    },

    // ── Delete ─────────────────────────────────────────────────────────────
    onDeleteTask: function (oEvent) {
      var oControl = oEvent.getSource();
      var oItem = null; var iMax = 10;
      while (oControl && iMax > 0) {
        if (oControl.isA && oControl.isA("sap.m.CustomListItem")) { oItem = oControl; break; }
        oControl = oControl.getParent(); iMax--;
      }
      var oCtx = oItem ? oItem.getBindingContext("kanban") : null;

      if (!oCtx) { return; }

      var sTaskId = oCtx.getProperty("TaskId");
      var sTitle = oCtx.getProperty("Title");

      MessageBox.confirm("Delete task \"" + sTitle + "\"?", {
        title: "Confirm Delete",
        onClose: function (sAction) {
          if (sAction === MessageBox.Action.OK) {
            var oModel = this.getView().getModel();
            oModel.remove("/DailyTasks('" + sTaskId + "')", {
              success: function () {
                MessageToast.show("Task deleted.");
                this._refreshAllLists();
              }.bind(this),
              error: function (oErr) {
                console.error("Delete failed:", oErr && oErr.responseText);
                MessageBox.error("Failed to delete task.");
              }
            });
          }
        }.bind(this)
      });
    }

  });
});