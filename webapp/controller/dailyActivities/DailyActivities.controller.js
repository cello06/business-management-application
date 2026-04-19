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

  var SCOPE_HINTS = {
    "MINE":           "Tasks currently assigned to you.",
    "ASSIGNED_BY_ME": "Tasks you delegated to others.",
    "TEAM":           "Tasks assigned to anyone in your sector.",
    "ALL":            "Every task in the system (leader view)."
  };

  // Priority meta — state maps to sap.ui.core.ValueState
  var mPriorityMeta = {
    "H": { label: "High",   state: "Error",   icon: "sap-icon://high-priority" },
    "M": { label: "Medium", state: "Warning", icon: "sap-icon://status-in-process" },
    "L": { label: "Low",    state: "Success", icon: "sap-icon://decline" }
  };

  // OData V2 Edm.DateTime comes as "/Date(ms)/" or occasionally as a Date
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

  function fmtDate(oDate) {
    if (!oDate) { return ""; }
    var pad = function (n) { return String(n).padStart(2, "0"); };
    return pad(oDate.getDate()) + "." + pad(oDate.getMonth() + 1) + "." + oDate.getFullYear();
  }

  // "Today" at midnight local — used to compare due dates
  function startOfToday() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  return Controller.extend("hrproject.controller.dailyActivities.DailyActivities", {

    onInit: function () {
      var oKanbanModel = new JSONModel({
        // displayed (post-search) arrays bound by the view
        backlog: [], todo: [], inProgress: [], test: [], completed: [],
        // full arrays (pre-search) kept in parallel so the search field
        // can toggle rows without another OData round-trip
        backlogFull: [], todoFull: [], inProgressFull: [],
        testFull: [], completedFull: [],
        backlogVisible: false,
        scope: "MINE",
        scopeHint: SCOPE_HINTS.MINE,
        isLeader: false,
        searchQuery: "",
        quickAdd: { activeColumn: "", title: "" },
        counts: { MINE: 0, ASSIGNED_BY_ME: 0, TEAM: 0, ALL: 0 }
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
      this._sMySectorId  = oComp._sSectorId || "";
      if (!this._sSapUsername || !this._sMySectorId) { this._lookupSapUsername(); }

      // Pick up role cached by Home; default to employee
      var oKanbanModel = this.getView().getModel("kanban");
      oKanbanModel.setProperty("/isLeader", !!oComp._bIsLeader);

      this._bEditMode = false;
      this._editTaskId = null;
      this._aTeamPersIds = null; // resolved lazily for TEAM scope
      this._mProjectsById = null;
      this._aProjects = [];

      this._ensureProjects();  // fire & forget — enrichment re-applies on load
      this._loadAllColumns();
      this._loadScopeCounts();
    },

    // ── Load Projects once per page visit ─────────────────────────────────
    _ensureProjects: function (fnDone) {
      fnDone = fnDone || function () {};
      if (this._mProjectsById) { return fnDone(); }

      var oModel = this.getView().getModel();
      var that = this;
      oModel.read("/Projects", {
        urlParameters: {
          "$select": "ProjectId,ProjectName",
          "$orderby": "ProjectName asc"
        },
        success: function (oData) {
          that._aProjects = oData.results || [];
          var m = {};
          that._aProjects.forEach(function (p) { m[p.ProjectId] = p; });
          that._mProjectsById = m;
          // Re-enrich already-loaded tasks so project names appear on cards
          that._reapplyEnrichment();
          fnDone();
        },
        error: function (oErr) {
          console.warn("Projects load failed:", oErr && oErr.responseText);
          that._mProjectsById = {};
          that._aProjects = [];
          fnDone();
        }
      });
    },

    // ── Fallback: lookup SapUsername + SectorId ────────────────────────────
    _lookupSapUsername: function () {
      var oModel = this.getView().getModel();
      var oComp  = this.getOwnerComponent();
      var sPersId = this._sPersId;
      var that = this;

      oModel.read("/Employees", {
        urlParameters: {
          "$filter": "PersId eq '" + sPersId + "'",
          "$select": "SapUsername,SectorId",
          "$top": "1"
        },
        success: function (oData) {
          if (oData.results && oData.results.length > 0) {
            that._sSapUsername = oData.results[0].SapUsername || "";
            that._sMySectorId  = oData.results[0].SectorId
              ? oData.results[0].SectorId.toString()
              : "";
            // Backfill Component cache for other controllers
            oComp._sSapUsername = oComp._sSapUsername || that._sSapUsername;
            oComp._sSectorId    = oComp._sSectorId    || that._sMySectorId;
          }
        }
      });
    },

    // ── Date helpers ───────────────────────────────────────────────────────
    _getTodayOData: function () {
      var oNow = new Date();
      var oUTC = Date.UTC(oNow.getFullYear(), oNow.getMonth(), oNow.getDate());
      return "/Date(" + oUTC + ")/";
    },

    _getNextTaskId: function (fnCallback) {
      var oModel = this.getView().getModel();
      oModel.read("/DailyTasks", {
        urlParameters: { "$select": "TaskId", "$orderby": "TaskId desc", "$top": "1" },
        success: function (oData) {
          var iMax = 0;
          if (oData.results && oData.results.length > 0) {
            iMax = parseInt(oData.results[0].TaskId, 10) || 0;
          }
          fnCallback((iMax + 1).toString());
        },
        error: function () { fnCallback(Date.now().toString().slice(-10)); }
      });
    },

    // ── Build a scope filter (without status) ──────────────────────────────
    // Calls fnCallback(sFilterOrNull). Null means "no filter applicable, skip".
    _buildScopeFilter: function (fnCallback) {
      var oKanbanModel = this.getView().getModel("kanban");
      var sScope = oKanbanModel.getProperty("/scope");

      if (sScope === "MINE") {
        return fnCallback("PersId eq '" + this._sPersId + "'");
      }
      if (sScope === "ASSIGNED_BY_ME") {
        if (!this._sSapUsername) { return fnCallback(null); }
        return fnCallback("AssignedBy eq '" + this._sSapUsername + "'");
      }
      if (sScope === "ALL") {
        return fnCallback(""); // no assignee filter
      }
      if (sScope === "TEAM") {
        var that = this;
        this._ensureTeamPersIds(function (aIds) {
          if (!aIds || aIds.length === 0) {
            fnCallback(null); // no team members → show nothing
            return;
          }
          // Include tasks where any TaskAssignee.PersId is in the team, not
          // just tasks whose primary DailyTasks.PersId is.
          that._getTeamTaskIdsFromAssignees(aIds, function (aExtraTaskIds) {
            var aParts = aIds.map(function (id) { return "PersId eq '" + id + "'"; });
            (aExtraTaskIds || []).forEach(function (tid) {
              aParts.push("TaskId eq '" + tid + "'");
            });
            fnCallback("(" + aParts.join(" or ") + ")");
          });
        });
        return;
      }
      fnCallback(null);
    },

    // Resolve TaskIds where any of the given PersIds appears in TaskAssignees.
    // Used to extend the Team scope beyond the DailyTasks.PersId primary.
    _getTeamTaskIdsFromAssignees: function (aTeamPersIds, fnDone) {
      if (!aTeamPersIds || aTeamPersIds.length === 0) { return fnDone([]); }
      var sFilter = aTeamPersIds
        .map(function (id) { return "PersId eq '" + id + "'"; })
        .join(" or ");
      this.getView().getModel().read("/TaskAssignees", {
        urlParameters: { "$filter": sFilter, "$select": "TaskId" },
        success: function (oData) {
          var seen = {};
          var aIds = [];
          (oData.results || []).forEach(function (a) {
            if (a.TaskId && !seen[a.TaskId]) {
              seen[a.TaskId] = true;
              aIds.push(a.TaskId);
            }
          });
          fnDone(aIds);
        },
        error: function (oErr) {
          console.warn("TaskAssignees team lookup failed — falling back to PersId-only filter:",
                       oErr && oErr.responseText);
          fnDone([]);
        }
      });
    },

    // ── Resolve all PersIds in my sector (once) ───────────────────────────
    _ensureTeamPersIds: function (fnDone) {
      if (this._aTeamPersIds) { return fnDone(this._aTeamPersIds); }
      var oModel = this.getView().getModel();
      var oComp  = this.getOwnerComponent();
      var that = this;

      var step2 = function (sSectorId) {
        if (!sSectorId) { that._aTeamPersIds = []; return fnDone([]); }

        var handleSuccess = function (oData) {
          that._aTeamPersIds = (oData.results || [])
            .map(function (e) { return e.PersId; })
            .filter(Boolean);
          console.log("Team PersIds for sector", sSectorId, ":", that._aTeamPersIds);
          fnDone(that._aTeamPersIds);
        };

        // Try numeric filter first; fall back to quoted if backend is NUMC
        oModel.read("/Employees", {
          urlParameters: {
            "$filter": "SectorId eq " + sSectorId,
            "$select": "PersId"
          },
          success: handleSuccess,
          error: function (oErrNumeric) {
            console.warn("Team numeric filter failed, retrying quoted:",
                         oErrNumeric && oErrNumeric.responseText);
            oModel.read("/Employees", {
              urlParameters: {
                "$filter": "SectorId eq '" + sSectorId + "'",
                "$select": "PersId"
              },
              success: handleSuccess,
              error: function (oErrQuoted) {
                console.error("Team quoted filter also failed:",
                              oErrQuoted && oErrQuoted.responseText);
                that._aTeamPersIds = [];
                fnDone([]);
              }
            });
          }
        });
      };

      // Prefer value resolved by Home → Component
      var sSector = this._sMySectorId || oComp._sSectorId || "";
      if (sSector) { return step2(sSector); }

      oModel.read("/Employees", {
        urlParameters: {
          "$filter": "PersId eq '" + this._sPersId + "'",
          "$select": "SectorId",
          "$top": "1"
        },
        success: function (oData) {
          var s = oData.results && oData.results.length
            ? (oData.results[0].SectorId ? oData.results[0].SectorId.toString() : "")
            : "";
          that._sMySectorId = s;
          if (s) { oComp._sSectorId = oComp._sSectorId || s; }
          step2(s);
        },
        error: function () { step2(""); }
      });
    },

    // ── Load all columns (scope-aware, with assignees via $expand) ────────
    _loadAllColumns: function () {
      var oKanbanModel = this.getView().getModel("kanban");
      var that = this;

      // BACKLOG — global, independent of scope
      that._readTasks("Status eq 'BACKLOG'", function (aRows) {
        that._setColumnData("backlog", aRows);
        var iCount = aRows.length;
        var oBtn = that.byId("backlogToggleBtn");
        if (oBtn) { oBtn.setText("Backlog (" + iCount + ")"); }
        var oCountCtrl = that.byId("backlogCount");
        if (oCountCtrl) { oCountCtrl.setText(iCount.toString()); }
      });

      this._buildScopeFilter(function (sScopeFilter) {
        ["todoList", "inProgressList", "testList", "completedList"].forEach(function (sListId) {
          var sStatus = mListStatus[sListId];
          var sPath   = mListPath[sListId];
          var sKey    = sPath.substring(1); // "/todo" -> "todo"
          var oCountCtrl = that.byId(mListCount[sListId]);

          if (sScopeFilter === null) {
            that._setColumnData(sKey, []);
            if (oCountCtrl) { oCountCtrl.setText("0"); }
            return;
          }

          var sStatusFilter = "Status eq '" + sStatus + "'";
          var sFilter = sScopeFilter
            ? "(" + sScopeFilter + ") and " + sStatusFilter
            : sStatusFilter;

          that._readTasks(sFilter, function (aRows) {
            that._setColumnData(sKey, aRows);
            if (oCountCtrl) {
              // Count of the unfiltered set — search applies only to display
              oCountCtrl.setText(String(aRows.length));
            }
          });
        });
      });
    },

    // Every column write goes through here so the search filter + due-date
    // sort stay consistent. Stores the full array in `${key}Full` and the
    // filtered array (after applying the current searchQuery) in `${key}`.
    _setColumnData: function (sKey, aRows) {
      var oKanbanModel = this.getView().getModel("kanban");
      var aSorted = (aRows || []).slice().sort(function (a, b) {
        // Earliest DueDate first; tasks with no date go to the bottom.
        var tA = a.dueDate ? a.dueDate.getTime() : Infinity;
        var tB = b.dueDate ? b.dueDate.getTime() : Infinity;
        return tA - tB;
      });
      oKanbanModel.setProperty("/" + sKey + "Full", aSorted);
      this._applySearchToColumn(sKey);
    },

    _applySearchToColumn: function (sKey) {
      var oKanbanModel = this.getView().getModel("kanban");
      var aAll = oKanbanModel.getProperty("/" + sKey + "Full") || [];
      var sQuery = (oKanbanModel.getProperty("/searchQuery") || "").toLowerCase();
      var aFiltered = !sQuery
        ? aAll
        : aAll.filter(function (t) {
            var sBlob = (t.Title || "") + " " + (t.Description || "") + " ";
            (t.assignees || []).forEach(function (a) {
              sBlob += (a.FullName || "") + " " + (a.SapUsername || "") + " ";
            });
            return sBlob.toLowerCase().indexOf(sQuery) !== -1;
          });
      oKanbanModel.setProperty("/" + sKey, aFiltered);
    },

    _reapplySearchAllColumns: function () {
      var that = this;
      ["backlog", "todo", "inProgress", "test", "completed"].forEach(function (k) {
        that._applySearchToColumn(k);
      });
    },

    onBoardSearch: function (oEvent) {
      var sQuery = oEvent.getParameter("newValue") || "";
      this.getView().getModel("kanban").setProperty("/searchQuery", sQuery);
      this._reapplySearchAllColumns();
    },

    // Shared tasks reader — expands to_Assignees/to_Employee, falls back to
    // a plain read if the backend chokes on the expand path.
    _readTasks: function (sFilter, fnSuccess) {
      var oModel = this.getView().getModel();
      var that = this;

      var finish = function (aResults) {
        fnSuccess(aResults.map(function (t) { return that._attachAssignees(t); }));
      };

      oModel.read("/DailyTasks", {
        urlParameters: {
          "$filter": sFilter,
          "$expand": "to_Assignees/to_Employee"
        },
        success: function (oData) { finish(oData.results || []); },
        error: function (oErrExpand) {
          console.warn("Task read with $expand failed, falling back:",
                       oErrExpand && oErrExpand.responseText);
          oModel.read("/DailyTasks", {
            urlParameters: { "$filter": sFilter },
            success: function (oData) { finish(oData.results || []); },
            error: function (oErr) {
              console.error("Task read failed:", oErr && oErr.responseText);
            }
          });
        }
      });
    },

    // Derive every view-facing field on the task from its OData fields.
    // Idempotent — safe to call multiple times as caches (projects,
    // assignees) become available. The view never reads raw fields like
    // Priority / DueDate / ProjectId directly; it uses the derived labels.
    _attachAssignees: function (oTask) {
      // ── 1. Assignees (cache > $expand > legacy) ─────────────────────────
      var aFromCache = this._mAssigneesByTask && this._mAssigneesByTask[oTask.TaskId];
      var aAssignees;
      if (aFromCache && aFromCache.length > 0) {
        aAssignees = aFromCache;
      } else {
        var aRaw = [];
        if (oTask.to_Assignees) {
          aRaw = oTask.to_Assignees.results || oTask.to_Assignees || [];
        }
        aAssignees = aRaw.map(function (a) {
          var e = a.to_Employee || {};
          var sName = (e.FirstName || e.Name    || "").trim();
          var sSur  = (e.LastName  || e.Surname || "").trim();
          var sFull = (sName + " " + sSur).trim() || e.SapUsername || a.PersId;
          return {
            PersId     : a.PersId,
            Role       : a.Role || "",
            SapUsername: e.SapUsername || "",
            FullName   : sFull
          };
        });
        if (aAssignees.length === 0 && oTask.SapUsername) {
          aAssignees.push({
            PersId     : oTask.PersId || "",
            Role       : "Owner",
            SapUsername: oTask.SapUsername,
            FullName   : oTask.SapUsername,
            legacy     : true
          });
        }
      }
      oTask.assignees = aAssignees;

      // ── 2. Priority ─────────────────────────────────────────────────────
      var oPriorityMeta = mPriorityMeta[(oTask.Priority || "").toUpperCase()];
      if (oPriorityMeta) {
        oTask.priorityLabel = oPriorityMeta.label;
        oTask.priorityState = oPriorityMeta.state;
        oTask.priorityIcon  = oPriorityMeta.icon;
      } else {
        oTask.priorityLabel = "";
        oTask.priorityState = "None";
        oTask.priorityIcon  = "";
      }

      // ── 3. Due date ─────────────────────────────────────────────────────
      var oDue = parseODataDate(oTask.DueDate);
      if (oDue) {
        oTask.dueDate = oDue;
        var oDueDay = new Date(oDue); oDueDay.setHours(0, 0, 0, 0);
        var iDiffDays = Math.round((oDueDay - startOfToday()) / 86400000);
        var sFmt = fmtDate(oDueDay);
        if (iDiffDays < 0) {
          oTask.dueDateState = "Error";
          oTask.dueDateLabel = "Overdue: " + sFmt;
        } else if (iDiffDays === 0) {
          oTask.dueDateState = "Warning";
          oTask.dueDateLabel = "Due today";
        } else if (iDiffDays <= 3) {
          oTask.dueDateState = "Warning";
          oTask.dueDateLabel = "Due in " + iDiffDays + "d: " + sFmt;
        } else {
          oTask.dueDateState = "None";
          oTask.dueDateLabel = "Due " + sFmt;
        }
      } else {
        oTask.dueDate = null;
        oTask.dueDateState = "None";
        oTask.dueDateLabel = "";
      }

      // ── 4. Project name (from cache) ────────────────────────────────────
      var oProj = (this._mProjectsById && oTask.ProjectId)
        ? this._mProjectsById[oTask.ProjectId]
        : null;
      oTask.projectName = oProj ? oProj.ProjectName : "";

      return oTask;
    },

    // Re-run _attachAssignees over every Full array — used when one of the
    // caches (projects, global assignees) lands after tasks were already
    // loaded and displayed.
    _reapplyEnrichment: function () {
      var oKanbanModel = this.getView().getModel("kanban");
      var that = this;
      ["backlog", "todo", "inProgress", "test", "completed"].forEach(function (sKey) {
        var aFull = oKanbanModel.getProperty("/" + sKey + "Full") || [];
        var aNew = aFull.map(function (t) {
          return that._attachAssignees(Object.assign({}, t));
        });
        that._setColumnData(sKey, aNew);
      });
    },

    // ── Totals for the scope-switcher labels ───────────────────────────────
    _loadScopeCounts: function () {
      var oModel = this.getView().getModel();
      var oKanbanModel = this.getView().getModel("kanban");
      var that = this;

      // MINE
      oModel.read("/DailyTasks/$count", {
        urlParameters: { "$filter": "PersId eq '" + this._sPersId + "'" },
        success: function (d) { oKanbanModel.setProperty("/counts/MINE", parseInt(d, 10) || 0); }
      });

      // ASSIGNED_BY_ME
      if (this._sSapUsername) {
        oModel.read("/DailyTasks/$count", {
          urlParameters: { "$filter": "AssignedBy eq '" + this._sSapUsername + "'" },
          success: function (d) { oKanbanModel.setProperty("/counts/ASSIGNED_BY_ME", parseInt(d, 10) || 0); }
        });
      }

      // ALL — only for leaders (but harmless to count for everyone)
      oModel.read("/DailyTasks/$count", {
        success: function (d) { oKanbanModel.setProperty("/counts/ALL", parseInt(d, 10) || 0); }
      });

      // TEAM — resolve team first
      this._ensureTeamPersIds(function (aIds) {
        if (!aIds || aIds.length === 0) {
          oKanbanModel.setProperty("/counts/TEAM", 0);
          return;
        }
        var sFilter = aIds.map(function (id) { return "PersId eq '" + id + "'"; }).join(" or ");
        oModel.read("/DailyTasks/$count", {
          urlParameters: { "$filter": sFilter },
          success: function (d) { oKanbanModel.setProperty("/counts/TEAM", parseInt(d, 10) || 0); }
        });
      });
    },

    _refreshAllLists: function () {
      this._loadAllAssignees();   // populates cache, re-applies on completion
      this._loadAllColumns();
      this._loadScopeCounts();
    },

    // ── Load every TaskAssignees row and group by TaskId ──────────────────
    // Secondary authoritative source for card-level assignee display — used
    // even when `_readTasks`'s $expand path isn't supported by the backend.
    _loadAllAssignees: function () {
      var oModel = this.getView().getModel();
      var that   = this;

      var mapAssignee = function (a) {
        var e = a.to_Employee || {};
        var sName = (e.FirstName || e.Name    || "").trim();
        var sSur  = (e.LastName  || e.Surname || "").trim();
        var sFull = (sName + " " + sSur).trim() || e.SapUsername || a.PersId;
        return {
          PersId     : a.PersId,
          Role       : a.Role || "",
          SapUsername: e.SapUsername || "",
          FullName   : sFull
        };
      };

      var index = function (aRows) {
        var m = {};
        aRows.forEach(function (a) {
          if (!m[a.TaskId]) { m[a.TaskId] = []; }
          m[a.TaskId].push(a);
        });
        that._mAssigneesByTask = m;
        that._reapplyAssignees();
      };

      // Try with $expand first so we get names in one hop
      oModel.read("/TaskAssignees", {
        urlParameters: { "$expand": "to_Employee" },
        success: function (oData) { index((oData.results || []).map(mapAssignee)); },
        error: function () {
          // Fallback: plain read, map with just PersId/SapUsername we have
          oModel.read("/TaskAssignees", {
            success: function (oData) {
              index((oData.results || []).map(function (a) {
                return {
                  PersId     : a.PersId,
                  Role       : a.Role || "",
                  SapUsername: "",
                  FullName   : a.PersId
                };
              }));
            },
            error: function (oErr) {
              console.warn("Global TaskAssignees load failed:",
                           oErr && oErr.responseText);
            }
          });
        }
      });
    },

    // Called once the global /TaskAssignees read finishes — refresh every
    // card with the authoritative assignee data.
    _reapplyAssignees: function () {
      this._reapplyEnrichment();
    },

    // ── Scope change ───────────────────────────────────────────────────────
    onScopeChange: function (oEvent) {
      var sScope = oEvent.getParameter("item").getKey();
      var oKanbanModel = this.getView().getModel("kanban");
      oKanbanModel.setProperty("/scope", sScope);
      oKanbanModel.setProperty("/scopeHint", SCOPE_HINTS[sScope] || "");
      this._loadAllColumns();
    },

    // ── Navigation ─────────────────────────────────────────────────────────
    onNavBack: function () {
      this.getOwnerComponent().getRouter().navTo("RouteHome");
    },

    onCardPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("kanban");
      if (!oCtx) { return; }
      var sTaskId = oCtx.getProperty("TaskId");
      if (!sTaskId) { return; }
      this.getOwnerComponent().getRouter().navTo("RouteTaskDetail", {
        persId : this._sPersId,
        taskId : sTaskId
      });
    },

    // ── Backlog toggle ─────────────────────────────────────────────────────
    onToggleBacklog: function () {
      var oKanbanModel = this.getView().getModel("kanban");
      oKanbanModel.setProperty("/backlogVisible", !oKanbanModel.getProperty("/backlogVisible"));
    },

    // ── Assign task to self (from backlog) ─────────────────────────────────
    onAssignTask: function (oEvent) {
      var oItem = this._findListItem(oEvent.getSource());
      var oCtx = oItem ? oItem.getBindingContext("kanban") : null;
      if (!oCtx) { return; }

      var sTaskId = oCtx.getProperty("TaskId");
      var sTitle  = oCtx.getProperty("Title");
      var sToday  = this._getTodayOData();
      var sPersId = this._sPersId;
      var sSapUsername = this._sSapUsername;
      var that = this;

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
            if (sAction !== MessageBox.Action.OK) { return; }
            var oModel = that.getView().getModel();
            var oPayload = {
              PersId: sPersId,
              SapUsername: sSapUsername,
              AssignedBy: sSapUsername,
              AssignedDate: sToday,
              Status: "TODO"
            };
            oModel.update("/DailyTasks('" + sTaskId + "')", oPayload, {
              success: function () {
                MessageBox.success(
                  "Task \"" + sTitle + "\" has been assigned to you!",
                  { title: "Task Assigned", onClose: function () { that._refreshAllLists(); } }
                );
              },
              error: function (oErr) {
                var sMsg = "Failed to assign task.";
                try {
                  var oResp = JSON.parse(oErr.responseText);
                  sMsg = oResp.error.message.value || sMsg;
                } catch (e) { }
                MessageBox.error(sMsg);
              }
            });
          }
        }
      );
    },

    // ── Find parent CustomListItem ─────────────────────────────────────────
    _findListItem: function (oControl) {
      var iMax = 10;
      while (oControl && iMax > 0) {
        if (oControl.isA && oControl.isA("sap.m.CustomListItem")) { return oControl; }
        oControl = oControl.getParent();
        iMax--;
      }
      return null;
    },

    // ── Drag & Drop ────────────────────────────────────────────────────────
    onDrop: function (oEvent) {
      var oDraggedItem = oEvent.getParameter("draggedControl");
      var oDroppedItem = oEvent.getParameter("droppedControl");
      var oDraggedCtx  = oDraggedItem ? oDraggedItem.getBindingContext("kanban") : null;
      if (!oDraggedCtx) { return; }

      var sTaskId    = oDraggedCtx.getProperty("TaskId");
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
      return this.byId(sId) || sap.ui.getCore().byId(this.getView().getId() + "--" + sId);
    },

    _setFormValues: function (sTitle, sDesc, sStatus, iPoints, sAssigneePersId,
                              sPriority, oDueDate, iProjectId) {
      if (this._getField("taskTitle"))    { this._getField("taskTitle").setValue(sTitle); }
      if (this._getField("taskDesc"))     { this._getField("taskDesc").setValue(sDesc); }
      if (this._getField("taskStatus"))   { this._getField("taskStatus").setSelectedKey(sStatus); }
      if (this._getField("taskPoints"))   { this._getField("taskPoints").setValue(iPoints); }
      if (this._getField("taskAssignee")) { this._getField("taskAssignee").setSelectedKey(sAssigneePersId || ""); }
      if (this._getField("taskPriority")) { this._getField("taskPriority").setSelectedKey(sPriority || "M"); }
      if (this._getField("taskDueDate"))  { this._getField("taskDueDate").setDateValue(oDueDate || null); }
      if (this._getField("taskProject")) {
        this._getField("taskProject").setSelectedKey(
          (iProjectId !== undefined && iProjectId !== null && iProjectId !== "")
            ? String(iProjectId) : ""
        );
      }
    },

    // Populate the Project select in the create/edit dialog. Safe to call
    // multiple times — items are regenerated from the cache each time so
    // newly added projects appear without special handling.
    _populateProjectSelect: function () {
      var oSelect = this._getField("taskProject");
      if (!oSelect) { return; }
      var Item = sap.ui.core.Item;
      oSelect.removeAllItems();
      oSelect.addItem(new Item({ key: "", text: "(no project)" }));
      (this._aProjects || []).forEach(function (p) {
        oSelect.addItem(new Item({ key: String(p.ProjectId), text: p.ProjectName }));
      });
    },

    // ── Load sector employees into the assignee dropdown ──────────────────
    _ensureAssigneeList: function (fnDone) {
      var oComboBox = this._getField("taskAssignee");
      if (!oComboBox) { return fnDone(); }
      if (oComboBox._loaded) { return fnDone(); }

      var oComp = this.getOwnerComponent();
      var sSector = this._sMySectorId || oComp._sSectorId || "";
      if (!sSector) {
        console.warn("_ensureAssigneeList: no sector — combo will be empty");
        fnDone();
        return;
      }

      var fill = function (aRows) {
        oComboBox.removeAllItems();
        var Item = sap.ui.core.Item;
        oComboBox.addItem(new Item({ key: "", text: "(unassigned)" }));
        aRows.forEach(function (e) {
          // _readEmployeesBySector already normalised FirstName/LastName.
          // Prefer new names, fall back to old — matches the same policy.
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

      this._readEmployeesBySector(sSector, fill, function () { fnDone(); });
    },

    // ═══════════════════════════════════════════════════════════════════════
    //  Per-column quick add (inline bottom-of-column)
    // ═══════════════════════════════════════════════════════════════════════
    onQuickAddOpen: function (oEvent) {
      var sStatus = oEvent.getSource().data("status");
      if (!sStatus) { return; }
      this.getView().getModel("kanban").setProperty("/quickAdd", {
        activeColumn: sStatus, title: ""
      });
      // Focus the now-visible input on the next tick
      var that = this;
      setTimeout(function () {
        var oInput = that.byId("quickAddInput" + sStatus);
        if (oInput) { oInput.focus(); }
      }, 50);
    },

    onQuickAddCancel: function () {
      this.getView().getModel("kanban").setProperty("/quickAdd", {
        activeColumn: "", title: ""
      });
    },

    onQuickAddSubmit: function (oEvent) {
      var sStatus = oEvent.getSource().data("status") ||
                    this.getView().getModel("kanban").getProperty("/quickAdd/activeColumn");
      if (!sStatus) { return; }
      var oKanbanModel = this.getView().getModel("kanban");
      var sTitle = (oKanbanModel.getProperty("/quickAdd/title") || "").trim();
      if (!sTitle) { MessageToast.show("Enter a title first."); return; }

      var that = this;
      var sToday = this._getTodayOData();
      var bBacklog = (sStatus === "BACKLOG");

      this._getNextTaskId(function (sTaskId) {
        var oPayload = {
          TaskId      : sTaskId,
          PersId      : bBacklog ? "" : that._sPersId,
          SapUsername : bBacklog ? "" : that._sSapUsername,
          Title       : sTitle,
          Description : "",
          Status      : sStatus,
          Points      : 1,
          BoardId     : "0000000001",
          CreatedOn   : sToday,
          ChangedOn   : sToday,
          CreatedBy   : that._sSapUsername,
          AssignedBy  : bBacklog ? "" : that._sSapUsername,
          AssignedDate: bBacklog ? null : sToday
        };
        that.getView().getModel().create("/DailyTasks", oPayload, {
          success: function () {
            MessageToast.show("Added: " + sTitle);
            // Clear the title but keep the input open so the user can add
            // another one straight away — faster rhythm for real use.
            oKanbanModel.setProperty("/quickAdd/title", "");
            that._refreshAllLists();
            setTimeout(function () {
              var oInput = that.byId("quickAddInput" + sStatus);
              if (oInput) { oInput.focus(); }
            }, 50);
          },
          error: function (oErr) {
            console.error("Quick-add create failed:", oErr && oErr.responseText);
            MessageBox.error("Could not create task.");
          }
        });
      });
    },

    // ── Create ─────────────────────────────────────────────────────────────
    onCreateTask: function () {
      this._bEditMode  = false;
      this._editTaskId = null;
      var that = this;
      this._openDialog(function () {
        that._oCreateDialog.setTitle("New Task");
        var oRow = that._getField("taskAssigneeRow");
        if (oRow) { oRow.setVisible(!!that.getOwnerComponent()._bIsLeader); }

        var setDefaults = function () {
          that._populateProjectSelect();
          that._setFormValues("", "", "TODO", 10, that._sPersId, "M", null, "");
        };

        that._ensureProjects(function () {
          if (that.getOwnerComponent()._bIsLeader) {
            that._ensureAssigneeList(setDefaults);
          } else {
            setDefaults();
          }
        });
      });
    },

    // ── Edit ───────────────────────────────────────────────────────────────
    onEditTask: function (oEvent) {
      var oItem = this._findListItem(oEvent.getSource());
      var oCtx  = oItem ? oItem.getBindingContext("kanban") : null;
      if (!oCtx) { return; }

      this._bEditMode  = true;
      this._editTaskId = oCtx.getProperty("TaskId");
      var sAssigneePers = oCtx.getProperty("PersId") || "";
      var sPriority     = (oCtx.getProperty("Priority") || "M").toUpperCase();
      var oDueDate      = parseODataDate(oCtx.getProperty("DueDate"));
      var iProjectId    = oCtx.getProperty("ProjectId");
      var that = this;

      this._openDialog(function () {
        that._oCreateDialog.setTitle("Edit Task");
        var oRow = that._getField("taskAssigneeRow");
        if (oRow) { oRow.setVisible(!!that.getOwnerComponent()._bIsLeader); }

        var applyValues = function () {
          that._populateProjectSelect();
          that._setFormValues(
            oCtx.getProperty("Title"),
            oCtx.getProperty("Description"),
            oCtx.getProperty("Status"),
            oCtx.getProperty("Points"),
            sAssigneePers,
            sPriority,
            oDueDate,
            iProjectId
          );
        };

        that._ensureProjects(function () {
          if (that.getOwnerComponent()._bIsLeader) {
            that._ensureAssigneeList(applyValues);
          } else {
            applyValues();
          }
        });
      });
    },

    onSaveTask: function () {
      if (this._bEditMode && this._editTaskId) { this._updateTask(); }
      else { this._createTask(); }
    },

    // Resolve selected assignee details {persId, sapUsername} via combo items
    _pickedAssignee: function () {
      var oComboBox = this._getField("taskAssignee");
      if (!oComboBox) { return null; }
      var sKey = oComboBox.getSelectedKey();
      if (!sKey) { return { persId: "", sapUsername: "" }; }
      var sText = oComboBox.getSelectedItem() ? oComboBox.getSelectedItem().getText() : "";
      // Text format: "First Last (SAPUSER)"
      var m = sText.match(/\(([^)]+)\)\s*$/);
      return { persId: sKey, sapUsername: m ? m[1] : "" };
    },

    _createTask: function () {
      var sTitle   = this._getField("taskTitle")   ? this._getField("taskTitle").getValue().trim()  : "";
      var sDesc    = this._getField("taskDesc")    ? this._getField("taskDesc").getValue().trim()   : "";
      var sStatus  = this._getField("taskStatus")  ? this._getField("taskStatus").getSelectedKey()  : "TODO";
      var iPoints  = this._getField("taskPoints")  ? this._getField("taskPoints").getValue()        : 10;
      var sPriority = this._getField("taskPriority") ? this._getField("taskPriority").getSelectedKey() : "M";
      var oDueJS    = this._getField("taskDueDate")  ? this._getField("taskDueDate").getDateValue()    : null;
      var sProjKey  = this._getField("taskProject")  ? this._getField("taskProject").getSelectedKey()  : "";
      var vProjectId = sProjKey ? parseInt(sProjKey, 10) : null;
      // DueDate payload: midnight UTC JS Date — UI5 serializes to Edm.DateTime
      var oDuePayload = oDueJS
        ? new Date(Date.UTC(oDueJS.getFullYear(), oDueJS.getMonth(), oDueJS.getDate()))
        : null;

      if (!sTitle) { MessageToast.show("Please enter a task title."); return; }

      // Resolve assignee: leader picks; everyone else = self
      var oAssignee;
      if (this.getOwnerComponent()._bIsLeader && this._getField("taskAssignee")) {
        oAssignee = this._pickedAssignee() || { persId: "", sapUsername: "" };
      } else {
        oAssignee = { persId: this._sPersId, sapUsername: this._sSapUsername };
      }

      var bBacklog = (sStatus === "BACKLOG") || !oAssignee.persId;
      if (!bBacklog && !oAssignee.persId) {
        MessageToast.show("Pick an assignee or set status to Backlog.");
        return;
      }

      var that = this;
      var sToday = this._getTodayOData();

      this._getNextTaskId(function (sTaskId) {
        var oPayload = {
          TaskId: sTaskId,
          PersId: bBacklog ? "" : oAssignee.persId,
          SapUsername: bBacklog ? "" : (oAssignee.sapUsername || ""),
          Title: sTitle,
          Description: sDesc,
          Status: bBacklog ? "BACKLOG" : sStatus,
          Points: iPoints,
          Priority: sPriority,
          DueDate: oDuePayload,
          ProjectId: vProjectId,
          BoardId: "0000000001",
          CreatedOn: sToday,
          ChangedOn: sToday,
          CreatedBy: that._sSapUsername,
          AssignedBy: bBacklog ? "" : that._sSapUsername,
          AssignedDate: bBacklog ? null : sToday
        };

        var oModel = that.getView().getModel();
        oModel.create("/DailyTasks", oPayload, {
          success: function () {
            MessageToast.show(bBacklog
              ? "Task added to Backlog!"
              : ("Task assigned to " + (oPayload.SapUsername || "user") + "."));
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
      var sTitle   = this._getField("taskTitle")   ? this._getField("taskTitle").getValue().trim()  : "";
      var sDesc    = this._getField("taskDesc")    ? this._getField("taskDesc").getValue().trim()   : "";
      var sStatus  = this._getField("taskStatus")  ? this._getField("taskStatus").getSelectedKey()  : "TODO";
      var iPoints  = this._getField("taskPoints")  ? this._getField("taskPoints").getValue()        : 10;
      var sPriority = this._getField("taskPriority") ? this._getField("taskPriority").getSelectedKey() : "M";
      var oDueJS    = this._getField("taskDueDate")  ? this._getField("taskDueDate").getDateValue()    : null;
      var sProjKey  = this._getField("taskProject")  ? this._getField("taskProject").getSelectedKey()  : "";
      var vProjectId = sProjKey ? parseInt(sProjKey, 10) : null;
      var oDuePayload = oDueJS
        ? new Date(Date.UTC(oDueJS.getFullYear(), oDueJS.getMonth(), oDueJS.getDate()))
        : null;

      if (!sTitle) { MessageToast.show("Please enter a task title."); return; }

      var oModel = this.getView().getModel();
      var sToday = this._getTodayOData();
      var oPayload = {
        Title: sTitle, Description: sDesc, Status: sStatus,
        Points: iPoints, ChangedOn: sToday,
        Priority: sPriority, DueDate: oDuePayload, ProjectId: vProjectId
      };

      // Leaders can reassign during edit
      if (this.getOwnerComponent()._bIsLeader && this._getField("taskAssignee")) {
        var oAssignee = this._pickedAssignee();
        if (oAssignee) {
          oPayload.PersId       = oAssignee.persId || "";
          oPayload.SapUsername  = oAssignee.sapUsername || "";
          oPayload.AssignedBy   = this._sSapUsername;
          oPayload.AssignedDate = oAssignee.persId ? sToday : null;
          if (!oAssignee.persId) { oPayload.Status = "BACKLOG"; }
        }
      }

      oModel.update("/DailyTasks('" + this._editTaskId + "')", oPayload, {
        success: function () {
          MessageToast.show("Task updated!");
          this._bEditMode  = false;
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

    // ═══════════════════════════════════════════════════════════════════════
    //  Card-level "Assign…" button (leader only) — two-step dialog
    //    Step 1: pick team (Sector)
    //    Step 2: pick employee from that team
    // ═══════════════════════════════════════════════════════════════════════
    onOpenAssignDialog: function (oEvent) {
      var oComp = this.getOwnerComponent();
      if (!oComp._bIsLeader) {
        MessageToast.show("Only leaders can reassign tasks.");
        return;
      }
      var oItem = this._findListItem(oEvent.getSource());
      var oCtx  = oItem ? oItem.getBindingContext("kanban") : null;
      if (!oCtx) { return; }

      var sTaskId  = oCtx.getProperty("TaskId");
      var sTitle   = oCtx.getProperty("Title");
      var sCurPers = oCtx.getProperty("PersId") || "";
      var sStatus  = oCtx.getProperty("Status");

      var oInitialData = {
        busy: false,
        step: 1,
        taskId: sTaskId,
        taskTitle: sTitle,
        taskStatus: sStatus,
        currentAssigneePersId: sCurPers,
        // Step 1 data
        sectors: [],
        // Step 2 data
        selectedSectorId: "",
        selectedSectorName: "",
        employees: [],
        filteredEmployees: [],
        searchQuery: "",
        // Final selection
        selectedPersId: "",
        selectedSapUsername: ""
      };

      var oAssign = this.getView().getModel("assign");
      if (!oAssign) {
        oAssign = new JSONModel(oInitialData);
        this.getView().setModel(oAssign, "assign");
      } else {
        oAssign.setData(oInitialData);
      }

      var that = this;
      this._openAssignDialog(function () {
        that._loadSectors();
      });
    },

    _openAssignDialog: function (fnAfterOpen) {
      if (!this._oAssignDialog) {
        Fragment.load({
          id: this.getView().getId(),
          name: "hrproject.view.dailyActivities.AssignTaskDialog",
          controller: this
        }).then(function (oDialog) {
          this._oAssignDialog = oDialog;
          this.getView().addDependent(oDialog);
          fnAfterOpen();
          oDialog.open();
        }.bind(this));
      } else {
        fnAfterOpen();
        this._oAssignDialog.open();
      }
    },

    // ── STEP 1: load all sectors ──────────────────────────────────────────
    _loadSectors: function () {
      var oAssign = this.getView().getModel("assign");
      var oModel  = this.getView().getModel();
      var that    = this;

      oAssign.setProperty("/busy", true);
      oModel.read("/Sectors", {
        urlParameters: { "$orderby": "SectorName asc" },
        success: function (oData) {
          oAssign.setProperty("/sectors", oData.results || []);
          oAssign.setProperty("/busy", false);
          var oList = that._getField("assignSectorList");
          if (oList && oList.removeSelections) { oList.removeSelections(true); }
        },
        error: function (oErr) {
          console.error("Sectors load failed:", oErr && oErr.responseText);
          oAssign.setProperty("/busy", false);
          MessageBox.error("Could not load teams.");
        }
      });
    },

    onSelectSector: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      if (!oItem) { return; }
      var oCtx = oItem.getBindingContext("assign");
      if (!oCtx) { return; }

      var vSectorId  = oCtx.getProperty("SectorId");
      var sSectorName = oCtx.getProperty("SectorName") || ("Sector " + vSectorId);
      if (vSectorId === undefined || vSectorId === null) { return; }
      var sSectorId = vSectorId.toString();

      var oAssign = this.getView().getModel("assign");
      oAssign.setProperty("/selectedSectorId",   sSectorId);
      oAssign.setProperty("/selectedSectorName", sSectorName);
      oAssign.setProperty("/selectedPersId",     "");
      oAssign.setProperty("/selectedSapUsername", "");
      oAssign.setProperty("/employees",          []);
      oAssign.setProperty("/filteredEmployees",  []);
      oAssign.setProperty("/step",               2);

      this._loadEmployeesForStep2(sSectorId);
    },

    onBackToTeams: function () {
      var oAssign = this.getView().getModel("assign");
      oAssign.setProperty("/step",               1);
      oAssign.setProperty("/selectedPersId",     "");
      oAssign.setProperty("/selectedSapUsername", "");
      // Drop the empty-cell selection on the sector list so the user can
      // pick the same sector again without it appearing "stuck".
      var oList = this._getField("assignSectorList");
      if (oList && oList.removeSelections) { oList.removeSelections(true); }
    },

    // ── STEP 2: load employees for the chosen sector ──────────────────────
    // Tries numeric filter first; falls back to quoted if backend field is
    // NUMC (Edm.String). That covers both schema choices without guessing.
    _loadEmployeesForStep2: function (sSectorId) {
      var oAssign = this.getView().getModel("assign");
      var that    = this;
      oAssign.setProperty("/busy", true);

      this._readEmployeesBySector(sSectorId,
        function (aEmps) {
          oAssign.setProperty("/employees",         aEmps);
          oAssign.setProperty("/filteredEmployees", aEmps);
          oAssign.setProperty("/busy",              false);
          var oList = that._getField("assignEmployeeList");
          if (oList && oList.removeSelections) { oList.removeSelections(true); }
          if (aEmps.length === 0) {
            MessageToast.show("No employees found in this team.");
          }
        },
        function (oErr) {
          oAssign.setProperty("/busy", false);
          var sDetail = "";
          try {
            var oResp = JSON.parse(oErr && oErr.responseText);
            sDetail = (oResp && oResp.error && oResp.error.message && oResp.error.message.value) || "";
          } catch (e) { /* ignore parse error */ }
          MessageBox.error(
            "Could not load team members." + (sDetail ? "\n\nBackend says:\n" + sDetail : "")
          );
        }
      );
    },

    // Shared helper: sector-scoped employee read.
    // SectorId is Edm.Int32 in $metadata — send unquoted. Keep a quoted
    // fallback in case a different mandant has it as NUMC.
    // Field names on Employees: FirstName / LastName / Title. We still
    // accept Name/Surname/PersonelTitle defensively so a future rename
    // doesn't silently break display.
    _readEmployeesBySector: function (sSectorId, fnSuccess, fnError) {
      var oModel = this.getView().getModel();

      var mapRow = function (e) {
        var sName  = (e.FirstName || e.Name    || "").trim();
        var sSur   = (e.LastName  || e.Surname || "").trim();
        var sTitle =  e.Title     || e.PersonelTitle || "";
        var sFull  = (sName + " " + sSur).trim() || (e.SapUsername || e.PersId);
        return {
          PersId        : e.PersId,
          SapUsername   : e.SapUsername || "",
          FirstName     : sName,
          LastName      : sSur,
          Title         : sTitle,
          // Keep legacy keys populated so any existing fragment binding
          // (`assign>PersonelTitle` etc.) still finds a value.
          Name          : sName,
          Surname       : sSur,
          PersonelTitle : sTitle,
          SectorId      : e.SectorId,
          fullName      : sFull
        };
      };

      var iNumericSector = parseInt(sSectorId, 10);
      var tryFilter = function (sFilter, fnOk, fnFail) {
        oModel.read("/Employees", {
          urlParameters: {
            "$filter": sFilter,
            "$select": "PersId,SapUsername,FirstName,LastName,Title,SectorId"
          },
          success: function (oData) { fnOk((oData.results || []).map(mapRow)); },
          error: fnFail
        });
      };

      tryFilter(
        "SectorId eq " + iNumericSector,
        fnSuccess,
        function (oErrNumeric) {
          console.warn("Numeric SectorId filter failed, retrying quoted:",
                       oErrNumeric && oErrNumeric.responseText);
          tryFilter(
            "SectorId eq '" + sSectorId + "'",
            fnSuccess,
            function (oErrQuoted) {
              console.error("Quoted SectorId filter also failed:",
                            oErrQuoted && oErrQuoted.responseText);
              fnError(oErrQuoted);
            }
          );
        }
      );
    },

    onAssignSearch: function (oEvent) {
      var sQuery = (oEvent.getParameter("newValue") || "").toLowerCase();
      var oAssign = this.getView().getModel("assign");
      var aAll = oAssign.getProperty("/employees") || [];
      var aFiltered = sQuery
        ? aAll.filter(function (e) {
            var sBlob = (e.fullName + " " + e.SapUsername + " " + (e.PersonelTitle || "")).toLowerCase();
            return sBlob.indexOf(sQuery) !== -1;
          })
        : aAll;
      oAssign.setProperty("/filteredEmployees", aFiltered);
      oAssign.setProperty("/searchQuery", sQuery);
    },

    onSelectEmployee: function (oEvent) {
      var oItem = oEvent.getParameter("listItem");
      var oAssign = this.getView().getModel("assign");
      if (!oItem) {
        oAssign.setProperty("/selectedPersId", "");
        oAssign.setProperty("/selectedSapUsername", "");
        return;
      }
      var oCtx = oItem.getBindingContext("assign");
      if (!oCtx) { return; }
      oAssign.setProperty("/selectedPersId", oCtx.getProperty("PersId") || "");
      oAssign.setProperty("/selectedSapUsername", oCtx.getProperty("SapUsername") || "");
    },

    onConfirmAssign: function () {
      var oAssign = this.getView().getModel("assign");
      var sTaskId      = oAssign.getProperty("/taskId");
      var sNewPersId   = oAssign.getProperty("/selectedPersId");
      var sNewUsername = oAssign.getProperty("/selectedSapUsername");

      if (!sTaskId || !sNewPersId) {
        MessageToast.show("Pick an employee first.");
        return;
      }

      var oComp = this.getOwnerComponent();
      var sMyUsername = this._sSapUsername || oComp._sSapUsername || "";

      // TaskId is NUMC10 — pad to 10 digits for the URL path
      var sPaddedTaskId = sTaskId.toString().padStart(10, "0");

      // "Today" at midnight UTC as a JS Date — UI5's OData V2 model
      // serializes this to the right Edm.DateTime string for the server.
      var oToday = new Date(Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate()
      ));

      // Payload omits TaskId — that's in the URL path via the parent nav
      var oPayload = {
        PersId      : sNewPersId,
        Role        : "Owner",
        AssignedBy  : sMyUsername,
        AssignedDate: oToday
      };

      var that = this;
      oAssign.setProperty("/busy", true);

      // POST via parent navigation — /TaskAssignees itself is not creatable.
      // The service binding accepts create only through the composition.
      this.getView().getModel().create(
        "/DailyTasks('" + sPaddedTaskId + "')/to_Assignees",
        oPayload,
        {
          success: function () {
            oAssign.setProperty("/busy", false);
            MessageToast.show("Assigned to " + (sNewUsername || sNewPersId) + ".");
            if (that._oAssignDialog) { that._oAssignDialog.close(); }
            that._refreshAllLists();
            // Phase 2 email hook — uncomment when backend ships the function import
            // oModel.callFunction("/SendTaskAssignmentMail", {
            //   urlParameters: { TaskId: sPaddedTaskId, PersId: sNewPersId }
            // });
          },
          error: function (oErr) {
            oAssign.setProperty("/busy", false);
            console.error("Assign failed:", oErr && oErr.responseText);
            var sMsg = "Failed to assign task.";
            try {
              var oResp = JSON.parse(oErr.responseText);
              sMsg = (oResp && oResp.error && oResp.error.message && oResp.error.message.value) || sMsg;
            } catch (e) { /* ignore parse errors */ }
            MessageBox.error(sMsg);
          }
        }
      );
    },

    onCancelAssign: function () {
      if (this._oAssignDialog) { this._oAssignDialog.close(); }
    },

    // ── Delete ─────────────────────────────────────────────────────────────
    onDeleteTask: function (oEvent) {
      var oItem = this._findListItem(oEvent.getSource());
      var oCtx  = oItem ? oItem.getBindingContext("kanban") : null;
      if (!oCtx) { return; }

      var sTaskId = oCtx.getProperty("TaskId");
      var sTitle  = oCtx.getProperty("Title");

      MessageBox.confirm("Delete task \"" + sTitle + "\"?", {
        title: "Confirm Delete",
        onClose: function (sAction) {
          if (sAction !== MessageBox.Action.OK) { return; }
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
        }.bind(this)
      });
    }

  });
});
