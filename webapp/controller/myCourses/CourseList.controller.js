sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/core/routing/History",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, History, Filter, FilterOperator) {
  "use strict";

  return Controller.extend("hrproject.controller.myCourses.CourseList", {

    onInit: function () {
      const oModel = new JSONModel({
        pageTitle:  "",
        type:       "",
        totalCount: 0,
        items:      [],
        allItems:   []
      });
      this.getView().setModel(oModel, "courseList");

      this.getOwnerComponent()
        .getRouter()
        .getRoute("RouteCourseList")
        .attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      const oArgs   = oEvent.getParameter("arguments");
      this._sType   = oArgs.type;
      this._sPersId = oArgs.persId;

      const oSearch = this.byId("courseSearchField");
      if (oSearch) oSearch.setValue("");

      const mTitles = {
        ongoing:  "Ongoing Courses",
        finished: "Finished Courses",
        all:      "All Courses",
        assigned: "Assigned Courses"
      };
      this.getView().getModel("courseList")
        .setProperty("/pageTitle", mTitles[this._sType] || "Courses");

      this._loadCourses();
    },

    // ── Data loading ─────────────────────────────────────────────────
    _loadCourses: function () {
      this.getView().setBusy(true);
      if (this._sType === "all") {
        this._loadAllCoursesWithEnrollment();
      } else {
        this._loadEmployeeCourses();
      }
    },

    // Load all courses AND cross-reference with employee's EmployeeCourses
    // to show In Progress / Completed badges
    _loadAllCoursesWithEnrollment: function () {
      const oModel  = this.getOwnerComponent().getModel();
      const sPersId = this._sPersId;

      // Fire both reads in parallel
      let aAllCourses    = null;
      let aEmpCourses    = null;
      let bCoursesLoaded = false;
      let bEmpLoaded     = false;

      const fnMerge = function () {
        if (!bCoursesLoaded || !bEmpLoaded) return;

        // Build enrollment lookup: CourseId → "ongoing" | "completed" | null
        const mEnrollment = {};
        aEmpCourses.forEach(function (oEC) {
          mEnrollment[oEC.CourseId] = oEC.ActiveCourse ? "ongoing" : "completed";
        });

        const aItems = aAllCourses.map(function (oCourse) {
          return {
            CourseId:         oCourse.CourseId,
            CourseName:       oCourse.CourseName   || ("Course " + oCourse.CourseId),
            CourseDesc:       oCourse.CourseDesc    || "",
            Category:         oCourse.Category      || "",
            DurationHours:    oCourse.DurationHours || 0,
            TotalHours:       oCourse.DurationHours || 0,
            CompletedHours:   0,
            ActiveCourse:     null,    // null = "all" view, hides progress bar
            ProgressPercent:  0,
            ProgressState:    "None",
            enrollmentStatus: mEnrollment[oCourse.CourseId] || null
            // null = not enrolled, "ongoing" = in progress, "completed" = done
          };
        });

        const oVM = this.getView().getModel("courseList");
        oVM.setProperty("/allItems",   aItems);
        oVM.setProperty("/items",      aItems);
        oVM.setProperty("/totalCount", aItems.length);
        this.getView().setBusy(false);
      }.bind(this);

      // Read 1: all courses
      oModel.read("/Courses", {
        success: function (oData) {
          aAllCourses    = oData.results || [];
          bCoursesLoaded = true;
          fnMerge();
        },
        error: function () {
          aAllCourses    = [];
          bCoursesLoaded = true;
          fnMerge();
        }
      });

      // Read 2: this employee's courses (for enrollment status)
      oModel.read("/EmployeeCourses", {
        urlParameters: {
          "$filter": "PersId eq '" + sPersId + "'",
          "$select": "CourseId,ActiveCourse"
        },
        success: function (oData) {
          aEmpCourses = oData.results || [];
          bEmpLoaded  = true;
          fnMerge();
        },
        error: function () {
          aEmpCourses = [];
          bEmpLoaded  = true;
          fnMerge();
        }
      });
    },

    _loadEmployeeCourses: function () {
      const oModel  = this.getOwnerComponent().getModel();
      const sType   = this._sType;
      const sPersId = this._sPersId;

      const aFilters = [new Filter("PersId", FilterOperator.EQ, sPersId)];
      if (sType === "ongoing") {
        aFilters.push(new Filter("ActiveCourse", FilterOperator.EQ, true));
      } else if (sType === "finished") {
        aFilters.push(new Filter("ActiveCourse", FilterOperator.EQ, false));
      }

      oModel.read("/EmployeeCourses", {
        filters: aFilters,
        success: function (oData) {
          const aEmpCourses = oData.results || [];
          if (!aEmpCourses.length) {
            const oVM = this.getView().getModel("courseList");
            oVM.setProperty("/allItems",   []);
            oVM.setProperty("/items",      []);
            oVM.setProperty("/totalCount", 0);
            this.getView().setBusy(false);
            return;
          }
          this._enrichWithCourseDetails(aEmpCourses);
        }.bind(this),
        error: function () {
          this.getView().setBusy(false);
        }.bind(this)
      });
    },

    _enrichWithCourseDetails: function (aEmpCourses) {
      const oModel = this.getOwnerComponent().getModel();

      const aCourseFilters = aEmpCourses.map(function (o) {
        return new Filter("CourseId", FilterOperator.EQ, o.CourseId);
      });

      oModel.read("/Courses", {
        filters: [new Filter({ filters: aCourseFilters, and: false })],
        success: function (oData) {
          const mById = {};
          (oData.results || []).forEach(function (c) { mById[c.CourseId] = c; });

          const aItems = aEmpCourses.map(function (oEC) {
            const oCourse    = mById[oEC.CourseId] || {};
            const iTotal     = Number(oEC.TotalHours     || oCourse.DurationHours || 0);
            const iCompleted = Number(oEC.CompletedHours || 0);
            const iRemaining = Math.max(0, iTotal - iCompleted);
            const fPercent   = iTotal > 0 ? (iCompleted / iTotal) * 100 : 0;

            let sState = "Error";
            if (fPercent >= 100)     sState = "Success";
            else if (fPercent >= 50) sState = "Warning";

            return {
              CourseId:         oEC.CourseId,
              PersId:           oEC.PersId,
              CourseName:       oCourse.CourseName   || ("Course " + oEC.CourseId),
              CourseDesc:       oCourse.CourseDesc    || "",
              Category:         oCourse.Category      || "",
              DurationHours:    oCourse.DurationHours || 0,
              TotalHours:       iTotal,
              CompletedHours:   iCompleted,
              RemainingHours:   iRemaining,
              ActiveCourse:     oEC.ActiveCourse,
              ProgressPercent:  Number(fPercent.toFixed(1)),
              ProgressState:    sState,
              enrollmentStatus: null   // not needed for employee-specific views
            };
          });

          const oVM = this.getView().getModel("courseList");
          oVM.setProperty("/allItems",   aItems);
          oVM.setProperty("/items",      aItems);
          oVM.setProperty("/totalCount", aItems.length);
          this.getView().setBusy(false);
        }.bind(this),
        error: function () {
          this.getView().setBusy(false);
        }.bind(this)
      });
    },

    // ── Search ───────────────────────────────────────────────────────
    onSearch: function (oEvent) {
      const sQuery = (oEvent.getParameter("newValue") || "").toLowerCase().trim();
      const oVM    = this.getView().getModel("courseList");
      const aAll   = oVM.getProperty("/allItems") || [];

      const aFiltered = sQuery
        ? aAll.filter(function (o) {
            return (o.CourseName || "").toLowerCase().includes(sQuery) ||
                   (o.CourseDesc || "").toLowerCase().includes(sQuery) ||
                   (o.Category   || "").toLowerCase().includes(sQuery);
          })
        : aAll;

      oVM.setProperty("/items",      aFiltered);
      oVM.setProperty("/totalCount", aFiltered.length);
    },

    // ── Navigation ───────────────────────────────────────────────────
    onCoursePress: function (oEvent) {
      const oCtx    = oEvent.getSource().getBindingContext("courseList");
      const oCourse = oCtx.getObject();

      if (!oCourse.CourseId) return;

      // For "All Courses": if enrolled → go to full CourseDetail with progress
      // If not enrolled → go to CourseDetail with "not enrolled" state (sectorId="0", persId="0")
      if (this._sType === "all") {
        const sEnrollment = oCourse.enrollmentStatus;

        if (sEnrollment === "ongoing" || sEnrollment === "completed") {
          // User is enrolled → show full progress detail
          this.getOwnerComponent().getRouter().navTo("RouteCourseDetail", {
            sectorId: "0",
            persId:   String(this._sPersId),
            courseId: String(oCourse.CourseId)
          });
        } else {
          // Not enrolled → show general info only (persId="0" signals not-enrolled state)
          this.getOwnerComponent().getRouter().navTo("RouteCourseDetail", {
            sectorId: "0",
            persId:   "0",
            courseId: String(oCourse.CourseId)
          });
        }
        return;
      }

      // Employee-specific views (ongoing, finished, assigned)
      const sPersId = oCourse.PersId || this._sPersId;
      this.getOwnerComponent().getRouter().navTo("RouteCourseDetail", {
        sectorId: "0",
        persId:   String(sPersId),
        courseId: String(oCourse.CourseId)
      });
    },

    onNavBack: function () {
      const sPreviousHash = History.getInstance().getPreviousHash();
      if (sPreviousHash !== undefined) {
        window.history.go(-1);
      } else {
        this.getOwnerComponent().getRouter().navTo("RouteMyCourses", {
          persId: this._sPersId
        });
      }
    }
  });
});