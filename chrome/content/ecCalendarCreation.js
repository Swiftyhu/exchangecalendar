/* ***** BEGIN LICENSE BLOCK *****
 * Version: GPL 3.0
 *
 * The contents of this file are subject to the General Public License
 * 3.0 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.gnu.org/licenses/gpl.html
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * -- Exchange 2007/2010 Calendar and Tasks Provider.
 * -- For Thunderbird with the Lightning add-on.
 *
 * This work is a combination of the Storage calendar, part of the default Lightning add-on, and 
 * the "Exchange Data Provider for Lightning" add-on currently, october 2011, maintained by Simon Schubert.
 * Primarily made because the "Exchange Data Provider for Lightning" add-on is a continuation 
 * of old code and this one is build up from the ground. It still uses some parts from the 
 * "Exchange Data Provider for Lightning" project.
 *
 * Author: Michel Verbraak (info@1st-setup.nl)
 * Website: http://www.1st-setup.nl/wordpress/?page_id=133
 * email: exchangecalendar@extensions.1st-setup.nl
 *
 *
 * This code uses parts of the Microsoft Exchange Calendar Provider code on which the
 * "Exchange Data Provider for Lightning" was based.
 * The Initial Developer of the Microsoft Exchange Calendar Provider Code is
 *   Andrea Bittau <a.bittau@cs.ucl.ac.uk>, University College London
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * ***** BEGIN LICENSE BLOCK *****/

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cu = Components.utils;

function exchCalendarCreation(aDocument, aWindow)
{
	this._document = aDocument;
	this._window = aWindow;

	this.globalFunctions = Cc["@1st-setup.nl/global/functions;1"]
				.getService(Ci.mivFunctions);
}

exchCalendarCreation.prototype = {
	oldLocationTextBox: "",
	oldNextPage: "",
	oldCache: false,
	oldOnPageAdvanced: "",

	firstTime: true,

	createPrefs : Cc["@mozilla.org/preferences-service;1"]
		.getService(Ci.nsIPrefService)
		.getBranch("extensions.exchangecalendar@extensions.1st-setup.nl.createcalendar."),

	doRadioExchangeCalendar: function _doRadioExchangeCalendar(type)
	{
		if (this.firstTime) {
			// Get the next page to change how it should advance.
			let aCustomizePage = this._document.getElementById('calendar-wizard').getPageById("customizePage");
			this.oldNextPage = aCustomizePage.getAttribute("next");
			this.oldOnPageAdvanced = aCustomizePage.getAttribute("onpageadvanced");

			this.firstTime = false;
		}

		if (type === "exchangecalendar") {

			// Get the next page to set back new values.
			let aCustomizePage = this._document.getElementById('calendar-wizard').getPageById("customizePage");
			aCustomizePage.setAttribute("next", "ecauth-wizardpage");
			aCustomizePage.setAttribute("onpageadvanced", "return true;");

			this.oldLocationTextBox = this._document.getElementById("calendar-uri").value;
			this.oldCache = this._document.getElementById("cache").checked;

			this._document.getElementById("calendar-uri").value = "https://auto/"+this.globalFunctions.getUUID();
			this._document.getElementById("calendar-uri").setAttribute("disabled",true);
			this._document.getElementById("calendar-uri").parentNode.setAttribute("collapsed", true);

			this._document.getElementById("cache").parentNode.hidden = true;
			this._document.getElementById("cache").checked = false;
			var temp = this._document.getElementById("cache").parentNode.parentNode;

			if(this._document.getElementById("exchange-cache-row")){
				this._document.getElementById("exchange-cache-row").setAttribute("collapsed", false);
			}

			// TODO: Take decision about checks that have to be done before allowing continue
			aCustomizePage.parentNode.canAdvance = true;
		}
		else {
			this._document.getElementById("calendar-uri").value = "";
			this._document.getElementById("calendar-uri").removeAttribute("disabled",false);
			this._document.getElementById("calendar-uri").parentNode.setAttribute("collapsed", false);

			// Get the next page to set back  how it should advance.
			var aCustomizePage = this._document.getElementById('calendar-wizard').getPageById("customizePage");
			aCustomizePage.setAttribute( "next", this.oldNextPage);
			aCustomizePage.setAttribute( "onpageadvanced", this.oldOnPageAdvanced);

			this._document.getElementById("cache").parentNode.hidden = false;
			this._document.getElementById("cache").checked = this.oldCache;

			if(this._document.getElementById("exchange-cache-row")){
				this._document.getElementById("exchange-cache-row").setAttribute("collapsed", true);
			}

			onSelectProvider(type);
		}
		
	},

	/*
	 * Run test on Exchange server to validate datas.
	 *
	 * This method is used in the wizardpage onpageadvanced attribute.
	 *
	 * So, it is called when:
	 *  1. User click on Next from an exchangecalendar wizard page
	 *  2. The asynchronus Exchange test is finished and the callback uses wizard.advance() method.
	 *
	 * Its return follows workflow defined by onadvancedpage:
	 * Return false to stay on ecauth wizard-page, return true to go next step.
	 */
	ecSendTestOnPageAdvanced: function _ecSendTestOnPageAdvanced() {
		let calendarWizard = this._document.getElementById('calendar-wizard');

		// Run test only if none is running
		if (! this.isTestRuning) {
			this.isTestRuning = true;

			// Disable Window while running
			calendarWizard.canAdvance = false;
			this._window.setCursor("wait");

			let self = this;

			// To be able to use the wizard.advance()
			// method, both parameters have to be 'true':
			//   * canAdvance have
			//   * self.isTestSucceed
			let advancePage = function _advancePage() {
				calendarWizard.canAdvance = true;
				self.isTestSucceed = true;
				self._document.getElementById('calendar-wizard').advance(null);
			}

			let endTest = function _endTest() {
				self.isTestRuning = false;
				self._window.setCursor("auto");
			}

			// Send callback test
			switch (calendarWizard.currentPage.pageid) {

				case 'ecauth-wizardpage':
					ecSettingsOverlay.ecAuthValidate(function (isTestSucceed) {
							if (isTestSucceed) {
								self._document.getElementById("ecauth-servertestfail").hidden = true;
								ecSettingsOverlay.ecAuthSavePasswordSetting();

								advancePage();
							}
							else {
								self._document.getElementById("ecauth-servertestfail").hidden = false;
							}

							endTest();
						} );
					break;

				case 'ecmailbox-wizardpage':
					ecSettingsOverlay.ecMailboxValidate(function(isTestSucceed) {
							if (isTestSucceed) {
								self._document.getElementById("ecmailbox-ownerorsharetestfail").hidden = true;

								advancePage();
							}
							else {
								self._document.getElementById("ecmailbox-ownerorsharetestfail").hidden = false;
							}

							endTest();
						});
					break;

				case 'ecfolderselect-wizardpage':
					ecSettingsOverlay.ecFolderSelectValidate(function (isTestSucceed) {
							if (isTestSucceed) {
								self._document.getElementById("ecfolderselect-foldertestfail").hidden = true;

								self.saveSettings();
								advancePage();
							}
							else {
								self._document.getElementById("ecfolderselect-foldertestfail").hidden = false;
							}

							endTest();
						} );
					break;

				default:
					this.isTestSucceed = true;
					endTest();
					break;
			}
		}

		// Return true only if authentication succeed
		if (this.isTestSucceed) {
			this.isTestRuning = false;
			this.isTestSucceed = false;

			return true;
		}

		// Return false to avoid going to next page by default
		// as this method is synchrone
		return false;
	},

	ecAuthLoad: function _ecAuthLoad() {
		this._document.getElementById("calendar-wizard").canAdvance = ecSettingsOverlay.ecAuthSanityCheck();
		this._document.getElementById("ecauth-servertestfail").hidden = true;
	},

	ecMailboxOnPageShow: function _ecMailboxOnPageShow() {
		this.createPrefs.deleteBranch("");

		// Preset folder owner if calendar email identity were selected inside the standard calendar properties page

		let emailIdentityItem = this._document.getElementById("email-identity-menulist").selectedItem;

		if(emailIdentityItem) {
			let emailIdentity = emailIdentityItem.getAttribute("value");
			let ecFolderOwner = this._document.getElementById("ecmailbox-owner");

			if (emailIdentity.toLowerCase() !== "none"
				&& ecFolderOwner.value === "") {

				let preferencesService = Cc["@mozilla.org/preferences-service;1"]
					.getService(Ci.nsIPrefService);

				let emailIdentityPref = preferencesService.getBranch("mail.identity." + emailIdentity + ".");

				ecFolderOwner.value = emailIdentityPref.getCharPref("useremail");

				this.createPrefs.setCharPref("mailbox", this._document.getElementById("ecmailbox-owner").value);
			}
		}

		this.ecMailboxLoad();
	},

	ecMailboxLoad: function _ecMailboxLoad() {
		this._document.getElementById("calendar-wizard").canAdvance = ecSettingsOverlay.ecMailboxOwnerOrShareSanityCheck();
		this._document.getElementById("ecmailbox-ownerorsharetestfail").hidden = true;
	},

	ecFolderSelectLoad: function _ecFolderSelectLoad() {
		this._document.getElementById("calendar-wizard").canAdvance = ecSettingsOverlay.ecMailboxOwnerOrShareValidated;

		let ecFolderPath = this._document.getElementById("ecfolderselect-folderpath");
		if (!ecFolderPath
			|| ecFolderPath.value === "") {
			ecFolderPath.value = "/";
		}

		this._document.getElementById("ecfolderselect-foldertestfail").hidden = true;
	},

	initExchange1: function _initExchange1()
	{
		this.createPrefs.deleteBranch("");

		var selItem = this._document.getElementById("email-identity-menulist").selectedItem;
		if (selItem) {
			var identity = selItem.getAttribute("value");
			if (identity != "none") {
				var identityPrefs = Cc["@mozilla.org/preferences-service;1"]
			            .getService(Ci.nsIPrefService)
				    .getBranch("mail.identity."+identity+".");

				this._document.getElementById("exchWebService_mailbox").value = identityPrefs.getCharPref("useremail");
				tmpSettingsOverlay.exchWebServicesInitMailbox(this._document.getElementById("exchWebService_mailbox").value);
				this.createPrefs.setCharPref("mailbox", this._document.getElementById("exchWebService_mailbox").value);
			}
			else {
				this._document.getElementById("exchWebService_mailbox").value = "";
			}
		}
		else {
			this.globalFunctions.LOG("no item selected");
		}


		this._document.getElementById("exchWebService_folderpath").value = "/";

		tmpSettingsOverlay.exchWebServicesCheckRequired();

	},

	/*
	 * saveSettings: save calendar settings after calendar wizard completed
	 *
	 * Lightning original code to save calendar can be found in:
	 * comm-central/calendar/resources/content/calendarCreation.js
	 */
	saveSettings: function _saveSettings()
	{
		this.globalFunctions.LOG("saveSettings Going to create the calendar in prefs.js");

		// Calculate the new calendar.id and properties
		let newCalId = this.globalFunctions.getUUID();
		let newCalName = this._document.getElementById("calendar-name").value;
		let newCalColor = this._document.getElementById("calendar-color").value;

		// Save settings in dialog to new cal id.
		ecSettingsOverlay.ecSettingsSaveCalendar(newCalId);

		// Need to save the useOfflineCache preference separetly because it is not part of the main.
		this.prefs = Cc["@mozilla.org/preferences-service;1"]
			.getService(Ci.nsIPrefService)
			.getBranch("extensions.exchangecalendar@extensions.1st-setup.nl."+newCalId+".");
		this.prefs.setBoolPref("useOfflineCache", this._document.getElementById("exchange-cache").checked);
		this.prefs.setIntPref("exchangePrefVersion", 1);

		// We create a new URI for this calendar which will contain the calendar.id
		var ioService = Cc["@mozilla.org/network/io-service;1"]
				.getService(Ci.nsIIOService);
		var tmpURI = ioService.newURI("https://auto/"+newCalId, null, null);

		// Register calendar to global settings
		var calPrefs = Cc["@mozilla.org/preferences-service;1"]
			.getService(Ci.nsIPrefService)
			.getBranch("calendar.registry."+newCalId+".");
		calPrefs.setCharPref("name", newCalName);

		// Create the new calendar object
		// Should be synced with Lightning doCreateCalendar() code
		var calManager = Cc["@mozilla.org/calendar/manager;1"]
			.getService(Ci.calICalendarManager);

		var newCal = calManager.createCalendar("exchangecalendar", tmpURI);

		newCal.id = newCalId;
		newCal.name = newCalName;

		newCal.setProperty("color", newCalColor);

		newCal.setProperty("cache.enabled", false);

		if (!this._document.getElementById("fire-alarms").checked) {
			newCal.setProperty("suppressAlarms", true);
		}
		// End of sync

		var emailCalendarIdentity = this._document.getElementById("email-identity-menulist").selectedItem;

		if (emailCalendarIdentity) {
			var identity = emailCalendarIdentity.getAttribute("value");
		}
		else {
			var identity = "";
		}

		newCal.setProperty("imip.identity.key", identity); 


		Cc["@mozilla.org/preferences-service;1"]
			.getService(Ci.nsIPrefService).savePrefFile(null);

		// Finally register completly the new calendar
		calManager.registerCalendar(newCal);
	},
}

var tmpCalendarCreation = new exchCalendarCreation(document, window);

