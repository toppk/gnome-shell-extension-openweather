/*
   This file is part of OpenWeather (gnome-shell-extension-openweather).

   OpenWeather is free software: you can redistribute it and/or modify it under the terms of
   the GNU General Public License as published by the Free Software Foundation, either
   version 3 of the License, or (at your option) any later version.

   OpenWeather is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY;
   without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
   See the GNU General Public License for more details.

   You should have received a copy of the GNU General Public License along with OpenWeather.
   If not, see <https://www.gnu.org/licenses/>.

   Copyright 2022 Jason Oickle
*/

import Adw from "gi://Adw";
import Gtk from "gi://Gtk";
import GObject from "gi://GObject";

import { gettext as _ } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js";

import { SearchResultsWindow } from "./searchResultsWindow.js";
import { GeolocationProvider } from "../constants.js";

class LocationsPage extends Adw.PreferencesPage {
  static {
    GObject.registerClass(this);
  }

  constructor(metadata, settings, parent) {
    super({
      title: _("Locations"),
      icon_name: "find-location-symbolic",
      name: "LocationsPage",
    });
    this.metadata = metadata;
    this._window = parent;
    this._settings = settings;
    this._count = null;
    this._locListUi = null;
    this._actualCity = this._settings.get_int("actual-city");
    let locationProvider = this._settings.get_enum("geolocation-provider");

    // Locations list group
    let addLocationButton = new Gtk.Button({
      child: new Adw.ButtonContent({
        icon_name: "list-add-symbolic",
        label: _("Add"),
      }),
    });
    this.locationsGroup = new Adw.PreferencesGroup({
      title: _("Locations"),
      header_suffix: addLocationButton,
    });
    this._refreshLocations();
    this.add(this.locationsGroup);

    // Geolocation providers group
    let providersGroup = new Adw.PreferencesGroup({
      title: _("Provider"),
    });
    let providersList = new Gtk.StringList();
    providersList.append("OpenStreetMap");
    providersList.append("Geocode.Farm");
    providersList.append("MapQuest");
    let providersListRow = new Adw.ComboRow({
      title: _("Geolocation Provider"),
      subtitle: _("Provider used for location search"),
      model: providersList,
      selected: locationProvider,
    });
    // Personal MapQuest API key
    let personalApiKeyMQEntry = new Gtk.Entry({
      max_length: 32,
      width_chars: 20,
      vexpand: false,
      sensitive:
        locationProvider === GeolocationProvider.MAPQUEST ? true : false,
      valign: Gtk.Align.CENTER,
    });
    let personalApiKeyMQRow = new Adw.ActionRow({
      title: _("Personal MapQuest Key"),
      subtitle: _("Personal API Key from developer.mapquest.com"),
      activatable_widget: personalApiKeyMQEntry,
    });
    let personalApiKeyMQ = this._settings.get_string(
      "geolocation-appid-mapquest"
    );
    if (personalApiKeyMQ !== "") {
      if (personalApiKeyMQ.length !== 32) {
        personalApiKeyMQEntry.set_icon_from_icon_name(
          Gtk.PositionType.LEFT,
          "dialog-warning"
        );
      } else {
        personalApiKeyMQEntry.set_icon_from_icon_name(
          Gtk.PositionType.LEFT,
          ""
        );
      }
      personalApiKeyMQEntry.set_text(personalApiKeyMQ);
    } else {
      personalApiKeyMQEntry.set_text("");
      personalApiKeyMQEntry.set_icon_from_icon_name(
        Gtk.PositionType.LEFT,
        "dialog-warning"
      );
    }

    personalApiKeyMQRow.add_suffix(personalApiKeyMQEntry);
    providersGroup.add(providersListRow);
    providersGroup.add(personalApiKeyMQRow);
    this.add(providersGroup);

    // Bind signals
    addLocationButton.connect("clicked", this._addLocation.bind(this));
    // Detect change in locations
    this._settings.connect("changed", () => {
      if (this._locationsChanged()) {
        this._actualCity = this._settings.get_int("actual-city");
        this._refreshLocations();
      }
    });
    providersListRow.connect("notify::selected", (widget) => {
      if (widget.selected === GeolocationProvider.MAPQUEST) {
        personalApiKeyMQEntry.set_sensitive(true);
      } else {
        personalApiKeyMQEntry.set_sensitive(false);
      }
      this._settings.set_enum("geolocation-provider", widget.selected);
    });
    personalApiKeyMQEntry.connect("notify::text", (widget) => {
      if (widget.text.length === 32) {
        this._settings.set_string("geolocation-appid-mapquest", widget.text);
        personalApiKeyMQEntry.set_icon_from_icon_name(
          Gtk.PositionType.LEFT,
          ""
        );
      } else {
        personalApiKeyMQEntry.set_icon_from_icon_name(
          Gtk.PositionType.LEFT,
          "dialog-warning"
        );
        if (widget.text.length === 0) {
          this._settings.set_string("geolocation-appid-mapquest", "");
        }
      }
    });
  }
  _refreshLocations() {
    let _city = this._settings.get_string("city");

    // Check if the location list UI needs updating
    if (this._locListUi !== _city) {
      if (_city.length > 0) {
        // Remove the old list
        if (this._count) {
          for (let i = 0; i < this._count; i++) {
            this.locationsGroup.remove(this.location[i].Row);
          }
          this._count = null;
        }
        let city = String(_city).split(" && ");
        if (city && typeof city === "string") {
          city = [city];
        }
        this.location = {};
        // Build new location UI list
        for (let i in city) {
          this.location[i] = {};
          this.location[i].ButtonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            spacing: 5,
            hexpand: false,
            vexpand: false,
          });
          this.location[i].EditButton = new Gtk.Button({
            icon_name: "document-edit-symbolic",
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
          });
          this.location[i].DeleteButton = new Gtk.Button({
            icon_name: "edit-delete-symbolic",
            valign: Gtk.Align.CENTER,
            css_classes: ["error"],
            hexpand: false,
            vexpand: false,
          });
          this.location[i].Row = new Adw.ActionRow({
            title: this._extractLocation(city[i]),
            subtitle: this._extractCoord(city[i]),
            icon_name:
              i === this._actualCity
                ? "checkbox-checked-symbolic"
                : "checkbox-symbolic",
            activatable: true,
          });
          this.location[i].ButtonBox.append(this.location[i].EditButton);
          this.location[i].ButtonBox.append(this.location[i].DeleteButton);
          this.location[i].Row.add_suffix(this.location[i].ButtonBox);
          this.locationsGroup.add(this.location[i].Row);
        }
        // Bind signals
        for (let i in this.location) {
          this.location[i].EditButton.connect("clicked", () => {
            this._editLocation(i);
          });
          this.location[i].DeleteButton.connect("clicked", () => {
            this._deleteLocation(i);
          });
          this.location[i].Row.connect("activated", () => {
            if (i !== this._actualCity) {
              this.location[i].Row.set_icon_name("checkbox-checked-symbolic");
              this.location[this._actualCity].Row.set_icon_name(
                "checkbox-symbolic"
              );
              this._actualCity = i;
              this._settings.set_int("actual-city", i);
              let _toast = new Adw.Toast({
                title: _("Location changed to: %s").format(
                  this.location[i].Row.get_title()
                ),
              });
              this._window.add_toast(_toast);
            }
            return 0;
          });
        }
        this._count = Object.keys(this.location).length;
      }
      this._locListUi = _city;
    }
    return 0;
  }
  _addLocation() {
    let _dialog = new Gtk.Dialog({
      title: _("Add New Location"),
      use_header_bar: true,
      transient_for: this._window,
      default_width: 600,
      default_height: -1,
      modal: true,
    });
    let _dialogPage = new Adw.PreferencesPage();
    let _dialogGroup = new Adw.PreferencesGroup();
    let _dialogRow = new Adw.PreferencesRow({
      activatable: false,
      focusable: false,
    });
    let _dialogBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_top: 10,
      margin_bottom: 10,
      margin_start: 10,
      margin_end: 10,
    });
    let _findLabel = new Gtk.Label({
      label: _("Search by Location or Coordinates"),
      halign: Gtk.Align.START,
      margin_bottom: 5,
      hexpand: true,
    });
    let _findEntry = new Gtk.Entry({
      placeholder_text: _("e.g. Vaiaku, Tuvalu or -8.5211767,179.1976747"),
      secondary_icon_name: "edit-clear-symbolic",
      secondary_icon_tooltip_text: _("Clear entry"),
      valign: Gtk.Align.CENTER,
      activates_default: true,
      hexpand: true,
      vexpand: false,
    });
    let _searchButton = new Gtk.Button({
      child: new Adw.ButtonContent({
        icon_name: "edit-find-symbolic",
        label: _("Search"),
      }),
      css_classes: ["suggested-action"],
    });
    _dialog.add_action_widget(_searchButton, 0);
    _dialog.set_default_response(0);
    let _dialogArea = _dialog.get_content_area();

    _dialogBox.append(_findLabel);
    _dialogBox.append(_findEntry);
    _dialogRow.set_child(_dialogBox);
    _dialogGroup.add(_dialogRow);
    _dialogPage.add(_dialogGroup);
    _dialogArea.append(_dialogPage);
    _dialog.show();

    // Bind signals
    _dialog.connect("response", (w, response) => {
      if (response === 0) {
        let _location = _findEntry.get_text().trim();
        if (_location === "") {
          // no input
          let _toast = new Adw.Toast({
            title: _("We need something to search for!"),
          });
          this._window.add_toast(_toast);
          return 0;
        }
        let resultsWindow = new SearchResultsWindow(
          this.metadata,
          this._window,
          this._settings,
          _location
        );
        resultsWindow.show();
      }
      _dialog.close();
      return 0;
    });
    _findEntry.connect("icon-release", (widget) => {
      widget.set_text("");
    });
    _dialog.connect("close-request", () => {
      _dialog.destroy();
    });
    return 0;
  }
  _editLocation(selected) {
    let _city = this._settings.get_string("city").split(" && ");

    let _dialog = new Gtk.Dialog({
      title: _("Edit %s").format(this._extractLocation(_city[selected])),
      use_header_bar: true,
      transient_for: this._window,
      default_width: 600,
      default_height: -1,
      modal: true,
    });
    let _dialogPage = new Adw.PreferencesPage();
    let _dialogGroup = new Adw.PreferencesGroup();
    let _dialogRow = new Adw.PreferencesRow({
      activatable: false,
      focusable: false,
    });
    let _dialogBox = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      margin_top: 10,
      margin_bottom: 10,
      margin_start: 10,
      margin_end: 10,
    });
    // location display name
    let _editNameLabel = new Gtk.Label({
      label: _("Edit Name"),
      halign: Gtk.Align.START,
      margin_bottom: 5,
      hexpand: true,
    });
    let _editNameEntry = new Gtk.Entry({
      text: this._extractLocation(_city[selected]),
      secondary_icon_name: "edit-clear-symbolic",
      secondary_icon_tooltip_text: _("Clear entry"),
      valign: Gtk.Align.CENTER,
      activates_default: true,
      hexpand: true,
      vexpand: false,
    });
    // location coordinates
    let _editCoordLabel = new Gtk.Label({
      label: _("Edit Coordinates"),
      halign: Gtk.Align.START,
      margin_top: 10,
      margin_bottom: 5,
      hexpand: true,
    });
    let _editCoordEntry = new Gtk.Entry({
      text: this._extractCoord(_city[selected]),
      secondary_icon_name: "edit-clear-symbolic",
      secondary_icon_tooltip_text: _("Clear entry"),
      valign: Gtk.Align.CENTER,
      activates_default: true,
      hexpand: true,
      vexpand: false,
    });
    let _saveButton = new Gtk.Button({
      child: new Adw.ButtonContent({
        icon_name: "document-save-symbolic",
        label: _("Save"),
      }),
      css_classes: ["suggested-action"],
    });
    _dialog.add_action_widget(_saveButton, 0);
    _dialog.set_default_response(0);
    let _dialogArea = _dialog.get_content_area();

    _dialogBox.append(_editNameLabel);
    _dialogBox.append(_editNameEntry);
    _dialogBox.append(_editCoordLabel);
    _dialogBox.append(_editCoordEntry);
    _dialogRow.set_child(_dialogBox);
    _dialogGroup.add(_dialogRow);
    _dialogPage.add(_dialogGroup);
    _dialogArea.append(_dialogPage);
    _dialog.show();

    // Bind signals
    _editNameEntry.connect("icon-release", (widget) => {
      widget.set_text("");
    });
    _editCoordEntry.connect("icon-release", (widget) => {
      widget.set_text("");
    });
    _dialog.connect("response", (w, response) => {
      if (response === 0) {
        let _location = _editNameEntry.get_text();
        let _coord = _editCoordEntry.get_text();
        let _provider = 0; // preserved for future use

        if (_coord === "" || _location === "") {
          let _toast = new Adw.Toast({
            title: _("Please complete all fields"),
          });
          this._window.add_toast(_toast);
          return 0;
        }
        if (_city.length > 0 && typeof _city !== "object") {
          _city = [_city];
        }
        _city[selected] = _coord + ">" + _location + ">" + _provider;

        if (_city.length > 1) {
          this._settings.set_string("city", _city.join(" && "));
        } else if (_city[0]) {
          this._settings.set_string("city", _city[0]);
        }
        let _toast = new Adw.Toast({
          title: _("%s has been updated").format(_location),
        });
        this._window.add_toast(_toast);
      }
      _dialog.close();
      return 0;
    });
    _dialog.connect("close-request", () => {
      _dialog.destroy();
    });
    return 0;
  }
  _deleteLocation(selected) {
    let _city = this._settings.get_string("city").split(" && ");
    if (!_city.length) {
      return 0;
    }
    let _dialog = new Gtk.Dialog({
      title: "",
      use_header_bar: true,
      transient_for: this._window,
      resizable: false,
      modal: true,
    });
    let _dialogPage = new Adw.PreferencesPage();
    let _dialogGroup = new Adw.PreferencesGroup();
    let _selectedName = this._extractLocation(_city[selected]);

    let _dialogRow = new Adw.ActionRow({
      title: _('Are you sure you want to delete "%s"?').format(_selectedName),
      icon_name: "help-about-symbolic",
      activatable: false,
      focusable: false,
    });
    let _dialogButton = new Gtk.Button({
      child: new Adw.ButtonContent({
        icon_name: "edit-delete-symbolic",
        label: _("Delete"),
      }),
      css_classes: ["destructive-action"],
    });
    _dialog.add_button(_("Cancel"), 0);
    _dialog.add_action_widget(_dialogButton, 1);
    _dialog.set_default_response(0);

    let _dialogArea = _dialog.get_content_area();
    _dialogGroup.add(_dialogRow);
    _dialogPage.add(_dialogGroup);
    _dialogArea.append(_dialogPage);
    _dialog.show();

    _dialog.connect("response", (w, response) => {
      if (response === 1) {
        if (_city.length === 0) {
          _city = [];
        }
        if (_city.length > 0 && typeof _city !== "object") {
          _city = [_city];
        }
        if (_city.length > 0) {
          _city.splice(selected, 1);
        }
        if (this._actualCity === selected) {
          this._settings.set_int("actual-city", 0);
        }
        if (_city.length > 1) {
          this._settings.set_string("city", _city.join(" && "));
        } else if (_city[0]) {
          this._settings.set_string("city", _city[0]);
        } else {
          this._settings.set_string("city", "");
        }
        let _toast = new Adw.Toast({
          title: _("%s has been deleted").format(_selectedName),
        });
        this._window.add_toast(_toast);
      }
      _dialog.close();
      return 0;
    });
    _dialog.connect("close-request", () => {
      _dialog.destroy();
    });
    return 0;
  }
  _locationsChanged() {
    let _city = this._settings.get_string("city");
    if (this._locListUi !== _city) {
      return true;
    }
    return false;
  }
  _extractLocation() {
    if (!arguments[0]) {
      return "";
    }
    if (arguments[0].search(">") === -1) {
      return _("Invalid city");
    }
    return arguments[0].split(">")[1].trim();
  }
  _extractCoord() {
    if (!arguments[0]) {
      return 0;
    }
    if (arguments[0].search(">") === -1) {
      return 0;
    }
    return arguments[0].split(">")[0];
  }
}

export { LocationsPage };
