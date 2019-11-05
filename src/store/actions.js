import api from "../api";
import axios from "axios";
import {
  LATENCY,
  SET_CURRENT_USER,
  UPDATE_CURRENT_USER,
  SET_BOOKMARKS,
  ADD_BOOKMARK,
  DELETE_BOOKMARK,
  LOADING_START,
  LOADING_FINISHED,
  SET_PROJECT_STATUS,
  UPDATE_PROJECT
} from "./mutation-types";

export function latency({ commit }) {
  const start = performance.now();
  const now = Date.now();

  api
    .ping()
    .then(() => {
      const end = performance.now();
      const delta = end - start;
      commit(LATENCY, {
        date: now,
        latency: delta
      });
    })
    .catch(error => {
      const end = performance.now();
      const delta = end - start;

      if (error.code === -2) {
        return commit(LATENCY, {
          date: now,
          latency: delta
        });
      }

      return commit(LATENCY, {
        date: now,
        latency: -1
      });
    });
}

export function getCurrentUser({ commit }) {
  return api
    .getMe({
      fields: ["id", "avatar.*", "email", "first_name", "last_name", "locale", "roles.*.*"]
    })
    .then(res => res.data)
    .then(userInfo => {
      return {
        ...userInfo,
        roles: userInfo.roles.map(obj => obj.role),
        admin: !!userInfo.roles.map(obj => obj.role).find(obj => obj.id === 1)
      };
    })
    .then(data => commit(SET_CURRENT_USER, data));
}

export function track({ commit, state }, { page }) {
  const currentUserID = state.currentUser.id;

  if (!currentUserID) {
    return;
  }

  const data = {
    last_page: page
  };

  commit(UPDATE_CURRENT_USER, data);
  return api.api.request("PATCH", `/users/${currentUserID}/tracking/page`, {}, data);
}

export function getBookmarks({ commit }) {
  return api.getMyBookmarks().then(bookmarks => {
    commit(SET_BOOKMARKS, bookmarks);
    return bookmarks;
  });
}

export function saveBookmark({ commit }, bookmark) {
  return api.createCollectionPreset(bookmark).then(res => {
    const savedBookmark = res.data;
    commit(ADD_BOOKMARK, savedBookmark);
    return savedBookmark;
  });
}

export function deleteBookmark({ commit }, bookmarkID) {
  commit(DELETE_BOOKMARK, bookmarkID);
  return api.deleteCollectionPreset(bookmarkID).catch(error => {
    this.$events.emit("error", {
      notify: this.$t("something_went_wrong_body"),
      error
    });
  });
}

export function loadingStart({ commit }, { id, desc }) {
  commit(LOADING_START, { id, desc });
}

export function loadingFinished({ commit }, id) {
  commit(LOADING_FINISHED, id);
}

export function getProjects({ commit, state }) {
  const apiRootPath = state.apiRootPath;
  const projects = state.projects;

  return Promise.allSettled(
    projects.map(async project => {
      const url = apiRootPath + project.key + "/";
      commit(SET_PROJECT_STATUS, { key: project.key, status: "loading" });

      try {
        const response = await axios.get(url);
        const {
          project_name,
          project_logo,
          project_color,
          project_image,
          project_icon
        } = response.data.data.api;
        const authenticated = response.data.public === undefined;

        commit(UPDATE_PROJECT, {
          key: project.key,
          data: {
            project_name,
            project_logo,
            project_color,
            project_image,
            project_icon,
            authenticated
          }
        });
        commit(SET_PROJECT_STATUS, { key: project.key, status: "successful" });
      } catch (error) {
        commit(UPDATE_PROJECT, { key: project.key, error });
        commit(SET_PROJECT_STATUS, { key: project.key, status: "failed" });
      }
    })
  );
}
