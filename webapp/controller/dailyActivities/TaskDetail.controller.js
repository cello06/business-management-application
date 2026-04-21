sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/core/Fragment",
  "sap/ui/model/json/JSONModel",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, Fragment, JSONModel, MessageToast, MessageBox) {
  "use strict";

  var mStatusMeta = {
    "BACKLOG":     { label: "Backlog",     state: "None",        color: "#534AB7" },
    "TODO":        { label: "To Do",       state: "Information", color: "#0064d9" },
    "IN_PROGRESS": { label: "In Progress", state: "Warning",     color: "#e9730c" },
    "TEST":        { label: "Test",        state: "Error",       color: "#6b2fbb" },
    "COMPLETED":   { label: "Completed",   state: "Success",     color: "#107e3e" }
  };

  var mPriorityMeta = {
    "H": { label: "High",   state: "Error"   },
    "M": { label: "Medium", state: "Warning" },
    "L": { label: "Low",    state: "Success" }
  };

  function parseODataDate(v) {
    if (!v) { return null; }
    if (v instanceof Date) { return v; }
    if (typeof v === "string" && v.indexOf("/Date(") !== -1) {
      var m = v.match(/\/Date\((-?\d+)\)\//);
      return m ? new Date(parseInt(m[1], 10)) : null;
    }
    var oParsed = new Date(v);
    return isNaN(oParsed.getTime()) ? null : oParsed;
  }

  function fmtODataDate(vDate) {
    if (!vDate) { return ""; }
    var oDate;
    if (vDate instanceof Date) {
      oDate = vDate;
    } else if (typeof vDate === "string" && vDate.indexOf("/Date(") !== -1) {
      oDate = new Date(parseInt(vDate.replace(/\/Date\((\d+)\)\//, "$1"), 10));
    } else if (typeof vDate === "string" && vDate.length === 8) {
      oDate = new Date(
        parseInt(vDate.slice(0, 4), 10),
        parseInt(vDate.slice(4, 6), 10) - 1,
        parseInt(vDate.slice(6, 8), 10)
      );
    } else {
      oDate = new Date(vDate);
    }
    if (isNaN(oDate.getTime())) { return ""; }
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return pad(oDate.getDate()) + "." + pad(oDate.getMonth() + 1) + "." + oDate.getFullYear();
  }

  return Controller.extend("hrproject.controller.dailyActivities.TaskDetail", {

    onInit: function () {
      this.getView().setModel(new JSONModel({
        busy: false,
        taskId: "",
        title: "",
        description: "",
        status: "TODO",
        statusLabel: "To Do",
        statusState: "Information",
        statusColor: "#0064d9",
        assignee: "",
        assigneePersId: "",
        assignedBy: "",
        assignedDateFmt: "",
        points: 0,
        pointsText: "",
        createdBy: "",
        createdOnFmt: "",
        changedOnFmt: "",
        boardId: "",
        assignees: [],
        priority: "",
        priorityLabel: "",
        priorityState: "None",
        dueDate: null,
        dueDateFmt: "",
        dueDateState: "None",
        projectId: null,
        projectName: ""
      }), "detail");

      this.getOwnerComponent().getRouter()
        .getRoute("RouteTaskDetail")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      var oArgs = oEvent.getParameter("arguments") || {};
      this._sPersId = oArgs.persId;
      this._sTaskId = oArgs.taskId;
      this._load();
    },

    _loadAssigneesForThisTask: function () {
      var oOData = this.getView().getModel();
      var oVm    = this.getView().getModel("detail");
      var sPadded = this._sTaskId.toString().padStart(10, "0");

      var mapRow = function (a) {
        var e = a.to_Employee || {};
        var sName = (e.FirstName || e.Name    || "").trim();
        var sSur  = (e.LastName  || e.Surname || "").trim();
        var sFull = (sName + " " + sSur).trim() || e.SapUsername || a.PersId;
        return {
          PersId     : a.PersId,
          SapUsername: e.SapUsername || "",
          Role       : a.Role || "",
          FullName   : sFull
        };
      };

      var ok = function (oData) {
        oVm.setProperty("/assignees", (oData.results || []).map(mapRow));
      };

      // Primary: direct filter on /TaskAssignees — same path the kanban
      // cards use, known to work. Read via /DailyTasks(..)/to_Assignees is
      // often rejected because the service only allows create on that nav.
      oOData.read("/TaskAssignees", {
        urlParameters: {
          "$filter": "TaskId eq '" + sPadded + "'",
          "$expand": "to_Employee"
        },
        success: ok,
        error: function (oErr1) {
          console.warn("Filtered TaskAssignees read failed, trying without $expand:",
                       oErr1 && oErr1.responseText);
          // Fallback: without $expand, we still get PersId/Role
          oOData.read("/TaskAssignees", {
            urlParameters: { "$filter": "TaskId eq '" + sPadded + "'" },
            success: ok,
            error: function (oErr2) {
              console.error("TaskAssignees read failed entirely:",
                            oErr2 && oErr2.responseText);
              oVm.setProperty("/assignees", []);
            }
          });
        }
      });
    },

    _load: function () {
      var oOData = this.getView().getModel();
      var oVm    = this.getView().getModel("detail");
      var that   = this;

      oVm.setProperty("/busy", true);
      oOData.read("/DailyTasks('" + this._sTaskId + "')", {
        success: function (oData) {
          var sStatusKey = (oData.Status || "").toUpperCase();
          var oMeta = mStatusMeta[sStatusKey] || mStatusMeta.TODO;

          var sPriority = (oData.Priority || "").toUpperCase();
          var oPriorityMeta = mPriorityMeta[sPriority] || { label: "", state: "None" };

          var oDue = parseODataDate(oData.DueDate);

          var aExistingAssignees = oVm.getProperty("/assignees") || [];
          oVm.setData({
            busy           : false,
            taskId         : oData.TaskId,
            title          : oData.Title,
            description    : oData.Description || "",
            status         : sStatusKey,
            statusLabel    : oMeta.label,
            statusState    : oMeta.state,
            statusColor    : oMeta.color,
            assignee       : oData.SapUsername || "",
            assigneePersId : oData.PersId || "",
            assignedBy     : oData.AssignedBy || "",
            assignedDateFmt: fmtODataDate(oData.AssignedDate),
            points         : oData.Points,
            pointsText     : (oData.Points !== undefined && oData.Points !== null)
                               ? (oData.Points + " MD")
                               : "—",
            createdBy      : oData.CreatedBy || "",
            createdOnFmt   : fmtODataDate(oData.CreatedOn),
            changedOnFmt   : fmtODataDate(oData.ChangedOn),
            boardId        : oData.BoardId || "",
            assignees      : aExistingAssignees,
            priority       : sPriority,
            priorityLabel  : oPriorityMeta.label,
            priorityState  : oPriorityMeta.state,
            dueDate        : oDue,
            dueDateFmt     : oDue ? fmtODataDate(oDue) : "",
            dueDateState   : "None",
            projectId      : (oData.ProjectId !== undefined && oData.ProjectId !== null)
                               ? oData.ProjectId : null,
            projectName    : ""
          });

          // Due-date urgency state (same rules as kanban cards)
          if (oDue) {
            var today = new Date(); today.setHours(0, 0, 0, 0);
            var dueDay = new Date(oDue); dueDay.setHours(0, 0, 0, 0);
            var diffDays = Math.round((dueDay - today) / 86400000);
            if (diffDays < 0)        { oVm.setProperty("/dueDateState", "Error"); }
            else if (diffDays <= 3)  { oVm.setProperty("/dueDateState", "Warning"); }
            else                     { oVm.setProperty("/dueDateState", "None"); }
          }

          that._loadAssigneesForThisTask();
          that._loadProjectNameForThisTask();
        },
        error: function () {
          oVm.setProperty("/busy", false);
          MessageBox.error("Could not load this task.");
        }
      });
    },

    // Small one-off read to resolve the project name for display.
    _loadProjectNameForThisTask: function () {
      var oVm = this.getView().getModel("detail");
      var iProjectId = oVm.getProperty("/projectId");
      if (iProjectId === null || iProjectId === undefined || iProjectId === "") { return; }

      this.getView().getModel().read("/Projects(" + parseInt(iProjectId, 10) + ")", {
        success: function (oP) {
          oVm.setProperty("/projectName", (oP && oP.ProjectName) || "");
        },
        error: function () { /* silently ignore */ }
      });
    },

    // ── Navigation ─────────────────────────────────────────────────────────
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteDailyActivities", {
        persId: this._sPersId
      });
    },

    // ── Edit — reuses CreateTaskDialog fragment ────────────────────────────
    onEditTask: function () {
      var oVm = this.getView().getModel("detail");
      var that = this;

      this._openDialog(function () {
        that._oCreateDialog.setTitle("Edit Task");
        var oRow = that._getField("taskAssigneeRow");
        var bIsLeader = !!that.getOwnerComponent()._bIsLeader;
        if (oRow) { oRow.setVisible(bIsLeader); }

        var finish = function () {
          if (that._getField("taskTitle"))   { that._getField("taskTitle").setValue(oVm.getProperty("/title")); }
          if (that._getField("taskDesc"))    { that._getField("taskDesc").setValue(oVm.getProperty("/description")); }
          if (that._getField("taskStatus"))  { that._getField("taskStatus").setSelectedKey(oVm.getProperty("/status")); }
          if (that._getField("taskPoints"))  { that._getField("taskPoints").setValue(oVm.getProperty("/points") || 0); }
          if (that._getField("taskAssignee")) {
            that._getField("taskAssignee").setSelectedKey(oVm.getProperty("/assigneePersId") || "");
          }
          if (that._getField("taskPriority")) {
            that._getField("taskPriority").setSelectedKey(oVm.getProperty("/priority") || "M");
          }
          if (that._getField("taskDueDate")) {
            that._getField("taskDueDate").setDateValue(oVm.getProperty("/dueDate") || null);
          }
          if (that._getField("taskProject")) {
            var vPid = oVm.getProperty("/projectId");
            that._getField("taskProject").setSelectedKey(
              (vPid !== null && vPid !== undefined && vPid !== "") ? String(vPid) : ""
            );
          }
        };

        // Load projects into the select, then load assignees (if leader),
        // then populate fields.
        that._ensureProjectsForDialog(function () {
          if (bIsLeader) { that._ensureAssigneeList(finish); } else { finish(); }
        });
      });
    },

    // ── Populate the Project dropdown in the dialog (TaskDetail variant) ──
    _ensureProjectsForDialog: function (fnDone) {
      fnDone = fnDone || function () {};
      var oSelect = this._getField("taskProject");
      if (!oSelect) { return fnDone(); }

      var Item = sap.ui.core.Item;
      var fill = function (aProjects) {
        oSelect.removeAllItems();
        oSelect.addItem(new Item({ key: "", text: "(no project)" }));
        (aProjects || []).forEach(function (p) {
          oSelect.addItem(new Item({ key: String(p.ProjectId), text: p.ProjectName }));
        });
        fnDone();
      };

      this.getView().getModel().read("/Projects", {
        urlParameters: {
          "$select": "ProjectId,ProjectName",
          "$orderby": "ProjectName asc"
        },
        success: function (oData) { fill(oData.results || []); },
        error: function () { fill([]); }
      });
    },

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
      return this.byId(sId) || sap.ui.getCore().byId(this.getView().getId() + "--" + sId);
    },

    _ensureAssigneeList: function (fnDone) {
      var oComboBox = this._getField("taskAssignee");
      if (!oComboBox) { return fnDone(); }
      if (oComboBox._loaded) { return fnDone(); }

      var oComp = this.getOwnerComponent();
      var sTeam = oComp._sTeamId || "";
      if (!sTeam) { return fnDone(); }

      var oModel = this.getView().getModel();
      var iTeam = parseInt(sTeam, 10);

      var fill = function (oData) {
        oComboBox.removeAllItems();
        var Item = sap.ui.core.Item;
        oComboBox.addItem(new Item({ key: "", text: "(unassigned)" }));
        (oData.results || []).forEach(function (e) {
          var sF = e.FirstName || e.Name    || "";
          var sL = e.LastName  || e.Surname || "";
          var sFull = (sF + " " + sL).trim() || (e.SapUsername || e.PersId);
          oComboBox.addItem(new Item({
            key : e.PersId,
            text: sFull + " (" + (e.SapUsername || "") + ")"
          }));
        });
        oComboBox._loaded = true;
        fnDone();
      };

      // Numeric filter (Edm.Int32), fallback to quoted if rejected
      oModel.read("/Employees", {
        urlParameters: {
          "$filter": "TeamId eq " + iTeam,
          "$select": "PersId,SapUsername,FirstName,LastName,Title,TeamId"
        },
        success: fill,
        error: function () {
          oModel.read("/Employees", {
            urlParameters: {
              "$filter": "TeamId eq '" + sTeam + "'",
              "$select": "PersId,SapUsername,FirstName,LastName,Title,TeamId"
            },
            success: fill,
            error: function (oErr) {
              console.error("Assignee list load failed:", oErr && oErr.responseText);
              fnDone();
            }
          });
        }
      });
    },

    _pickedAssignee: function () {
      var oComboBox = this._getField("taskAssignee");
      if (!oComboBox) { return null; }
      var sKey = oComboBox.getSelectedKey();
      if (!sKey) { return { persId: "", sapUsername: "" }; }
      var sText = oComboBox.getSelectedItem() ? oComboBox.getSelectedItem().getText() : "";
      var m = sText.match(/\(([^)]+)\)\s*$/);
      return { persId: sKey, sapUsername: m ? m[1] : "" };
    },

    onSaveTask: function () {
      var sTitle    = this._getField("taskTitle")    ? this._getField("taskTitle").getValue().trim()  : "";
      var sDesc     = this._getField("taskDesc")     ? this._getField("taskDesc").getValue().trim()   : "";
      var sStatus   = this._getField("taskStatus")   ? this._getField("taskStatus").getSelectedKey()  : "TODO";
      var iPoints   = this._getField("taskPoints")   ? this._getField("taskPoints").getValue()        : 0;
      var sPriority = this._getField("taskPriority") ? this._getField("taskPriority").getSelectedKey() : "M";
      var oDueJS    = this._getField("taskDueDate")  ? this._getField("taskDueDate").getDateValue()    : null;
      var sProjKey  = this._getField("taskProject")  ? this._getField("taskProject").getSelectedKey()  : "";
      var vProjectId = sProjKey ? parseInt(sProjKey, 10) : null;
      var oDuePayload = oDueJS
        ? new Date(Date.UTC(oDueJS.getFullYear(), oDueJS.getMonth(), oDueJS.getDate()))
        : null;

      if (!sTitle) { MessageToast.show("Please enter a task title."); return; }

      var oModel = this.getView().getModel();
      var oNow = new Date();
      var sToday = "/Date(" + Date.UTC(oNow.getFullYear(), oNow.getMonth(), oNow.getDate()) + ")/";
      var oPayload = {
        Title: sTitle, Description: sDesc, Status: sStatus,
        Points: iPoints, ChangedOn: sToday,
        Priority: sPriority, DueDate: oDuePayload, ProjectId: vProjectId
      };

      if (this.getOwnerComponent()._bIsLeader && this._getField("taskAssignee")) {
        var oAssignee = this._pickedAssignee();
        if (oAssignee) {
          oPayload.PersId       = oAssignee.persId || "";
          oPayload.SapUsername  = oAssignee.sapUsername || "";
          oPayload.AssignedBy   = this.getOwnerComponent()._sSapUsername || "";
          oPayload.AssignedDate = oAssignee.persId ? sToday : null;
          if (!oAssignee.persId) { oPayload.Status = "BACKLOG"; }
        }
      }

      var that = this;
      oModel.update("/DailyTasks('" + this._sTaskId + "')", oPayload, {
        success: function () {
          MessageToast.show("Task updated!");
          that._oCreateDialog.close();
          that._load();
        },
        error: function (oErr) {
          console.error("Update failed:", oErr && oErr.responseText);
          MessageBox.error("Failed to update task.");
        }
      });
    },

    onCancelTask: function () {
      if (this._oCreateDialog) { this._oCreateDialog.close(); }
    },

    // ── Delete ─────────────────────────────────────────────────────────────
    onDeleteTask: function () {
      var that = this;
      MessageBox.confirm("Delete this task?", {
        title: "Confirm Delete",
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) { return; }
          that.getView().getModel().remove("/DailyTasks('" + that._sTaskId + "')", {
            success: function () {
              MessageToast.show("Task deleted.");
              that.getOwnerComponent().getRouter().navTo("RouteDailyActivities", {
                persId: that._sPersId
              });
            },
            error: function () { MessageBox.error("Failed to delete task."); }
          });
        }
      });
    }

  });
});
