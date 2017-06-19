/********************** Ontology Proof Sheet Prototype ************************

	This script provides the engine for displaying OBOFoundry.org compatible 
	ontologies, allowing one to search and browse any data representation model 
	items therein, as well
	as root terms and their branches, mainly renders a menu of ontology entities, and a form viewer
	that focuses on a selected entity.

	Author: Damion Dooley
	Project: GenEpiO.org Genomic Epidemiology Ontology
	Updated: May 28, 2017

	Note: we can get a dynamic list of OBOFoundry ontologies via: 
	http://sparql.hegroup.org/sparql?default-graph-uri=&query=SELECT+%3Fv+WHERE+%7B%3Fx+owl%3AversionIRI+%3Fv%7D&format=json   //&timeout=0&debug=on

	TO DO:
	 - Hyperlink form labels so user can view them independently of form they are in?
	 - seems like URL geem/#ontologyID/... isn't updating browser address bar, or on a RELOAD to load Form View.
	 - FIX: View Mockup data button triggering form submit.
	 - FIX: merge picklist and specification dictionaries.
	 - basic datatype & precision standard hould be a function of unit, i.e. annotated onto unit choice for this field.
	 - disjunction tabbed interface has wrong required status?
	 - for select pulldown lists, enable mouseover of selected term to provide more detail, e.g. ontology id.



	Author: Damion Dooley
	Project: genepio.org/geem

*/

/*********** ALL THE SETUP ***************************************************/

data = {}
bag = {}
formatD = 'yyyy-mm-dd'
formatT = 'Thh:ii:SS'
shoppingCart=[]
shoppingCartOff=[]
searchDB = ''
top.focusEntityId = null

/*********** ACTION *****************************************************
	This loads the json user interface oriented version of an ontology
	After ajax load of ontology_ui.json, top.data contains:
	{
		@context
		specifications
		units
		picklists
	}
*/

$( document ).ready(function() {

	initFoundation()

	$.getJSON('ontology_ui.json', function( data ) {
		// Setup Zurb Foundation user interface and form validation
		top.data = data;
		// Default entity to render:
		top.focusEntityId = null

		myForm = new OntologyForm("#mainForm", data) // Provide ID of form to populate.

		// This control toggles the visibility of ontology ID's in the given 
		// form content (for reference during content review)
		$('input#toggleIdVisibility').on('change', function() {
			myForm.ontologyDetails = $(this).is(':checked')
			myForm.renderEntity(top.focusEntityId)
		})

		// Display all optional elements as label [+] for concise display.
		$('input#toggleMinimalForm').on('change', function() {
			myForm.minimalForm = $(this).is(':checked')
			myForm.renderEntity(top.focusEntityId)
		})

		// Show Data Representation Model item menu
		$("ul#entityMenu").html(renderMenu('obo:OBI_0000658'))

		// Provide type-as-you-go searching
		$("#searchField").on('keyup', function() {
			var text = $(this).val().toLowerCase()
			searchAsYouType(top.data.specifications, text)
		})

		$("#searchResults").on('mouseenter','i.fi-arrow-up.dropdown', searchResultContext)
		
		$("#makePackageForm").on('submit', function() {
			/* A package consists of 
			{
				name: string
				description: string
				version: int //auto-increment per update function.
				ontologies:	[
					{prefix: string // "genepio"; OBOFoundry ontology lower case name.
					version: string // identifier or if none, GEEM download date.
					}
				] 
				specifications:
					{}

			}


			*/
		})


		$('ul#entityMenu *').on('click', function(event) { 
			// Enables eye icon click to show form without opening/closing the accordion.
  			event.stopPropagation();
  			if ($(event.target).is('i.fi-magnifying-glass') ) {myForm.renderEntity(getEntityId(event.target))}
		});



		$("#shoppingCart")
			.on("click", 'div.cart-item', function(event) {
				event.stopPropagation(); // otherwise parent cart items catch same click
				if ($(event.target).is('i.fi-shopping-cart'))
					// Change state of shopping cart item
					cartCheck(this.dataset.ontologyId)
				else
					// Follow link if user didn't click
					myForm.renderEntity(this.dataset.ontologyId)
			})


		$("#shoppingCartTrash").on('click', function() {
			top.shoppingCart=[]
			top.shoppingCartOff=[]
			$('form#mainForm div[data-ontology-id]').removeClass('include exclude')
			$('#shoppingCart').empty()
		})

		$(document).foundation()

		$(window).on('hashchange',function(){ 
			// GEEM focuses on entities by way of a URL with hash #[entityId]
		    if (location.hash.length > 0)
			   	if (location.hash.substr(0,5) =='#obo:') {
					top.focusEntityId = document.location.hash.substr(1)
					myForm.renderEntity(top.focusEntityId)
				}
		});



		//Trying to prime menu with given item
		//$('#sidebar > ul').foundation('down', $('#obo:OBI_0001741') ) ; //Doesn't work?!
	});
});

function getEntity(ontologyId) {
	var entity = top.data['specifications'][ontologyId]
	if (!entity) entity = top.data['picklists'][ontologyId]
	return entity
}

function getEntityId(item) {
	return $(item).parents('.cart-item,.field-wrapper').first()[0].dataset.ontologyId
}

/*********** SEARCH AND RESULTS *************************/
function searchAsYouType(collection, text) {
	/* As user types text into searchField, exact substring search is conducted
	 through top.data.specifications entities (all of their numeric or textual 
	 attributes)
	*/
	text = text.toLowerCase()
	$("#searchResults").empty()
	var results = []
	if (text.length > 2) {
		var ontology_ids = filterIt(collection, text)
		for (id in ontology_ids) {
			results.push(renderCartObj(ontology_ids[id]))
		}
		
		// FIX FIX FIX
		// Picklist items are currently in a separate list.
		var ontology_ids = filterIt(top.data.picklists, text) 
		//if (ontology_ids.length > 0)
		//	$("#searchResults").append('<hr/><strong>Picklist Items</strong><br/>')
		for (id in ontology_ids) {
			results.push(renderCartObj(ontology_ids[id]))
		}
		// Sort results alphabetically.  Consider other sort metrics?
		results.sort(function(a,b){return a[0].localeCompare(b[0]) })
		resultsHTML = results.map(function(obj) {return obj[1]})
		$("#searchResults").append(resultsHTML.join('\n'))
	}

}

function filterIt(obj, searchKey) {
	/* Text Search of ontology contents via JSON specification.
	This looks at each "specification" entry's main fields, e.g.: label, 
	uiLabel, definition, uiDefinition, hasSynonym, hasNarrowSynonym, 
	hasExactSynonym.
	 */

    return Object.keys(obj).filter(function(key) { // key is specification ontology id.
      return Object.keys(obj[key]).some(function(key2) {
      	if (typeof obj[key][key2] === "object")
      		return false
      	else
      		// FUTURE: add wildcard searching?
      		return obj[key][key2].toLowerCase().includes(searchKey);
      })
    })
}

function searchResultContext(event) {
	/* Provide mouseover function to see dropdown menu that shows given item
	as well as any parent items that link to it via "has member" and "has part"
	and "is a" relations. Parents can be navigated to.
	*/
	parent = $('#navigateParentDropdown')
	if (parent.length) {
		$('#navigateParentDropdown').foundation('destroy') // or else subsequent dropdown position is fixed.
		$('#navigateParentButton,#navigateParentDropdown').remove()
	}
	var thisDiv = $(this).parent()
	var ontologyId = thisDiv.attr('data-ontology-id')

	// Though it is hidden, have to include button or else Foundation throws error.
	var domEl = ['<button id="navigateParentButton" data-toggle="navigateParentDropdown"></button>',
		'<div id="navigateParentDropdown" class="dropdown-pane"><ul>',
		getRelationsHTML(ontologyId),
		'</ul></div>'].join('')

	$(this).after($(domEl)).foundation() //Places it.
	var elem = new Foundation.Dropdown($('#navigateParentDropdown'), {hover:true, hoverPane:true});
	iconPosition = $(this).position()
	$('#navigateParentDropdown').foundation('open')
		.css('left', (iconPosition.left + 20) + 'px')
		.css('top', (iconPosition.top) + 'px')
		// Drop-down content is defined, now we ennervate the up-arrows.
		// each can replace content 
		.on('click','i.fi-arrow-up',function(event){
			// Insert shopping cart item 
			var target = $(event.target).parent()
			var targetId = target[0].dataset.ontologyId
			// DETECT IF ITEM HAS ALREADY HAD PARENTS ADDED?
			if ($('#navigateParentDropdown ul[data-ontology-id="'+targetId+'"]').length == 0 ) {
				target.parent().wrap('<ul data-ontology-id="'+targetId+'">')
				target.parent().before(getRelationsHTML(targetId))
			}
		})

}

function getRelationsHTML(ontologyId) {
	// Finds and draws relations as li links for given entity
	var entity = getEntity(ontologyId) 

	var filling = ''
	if ('parent' in entity) {
		filling += getRelationLink('parent', getEntity(entity['parent']))
	}
	// Possibly organize each entity's relations under a "relations" section?
	for (const relation of ['member_of','part_of']) {
		if (relation in entity) {
			for (const targetId of entity[relation]) {
				filling += getRelationLink(relation, getEntity(targetId))
			}
		}
	}
	return filling
}

function getRelationLink(relation, entity) {
	// Used in search results
	// Usually but not always there are links.  Performance boost if we drop this test.
	var links = ('parent' in entity || 'member_of' in entity || 'part_of' in entity)
	return ['<li data-ontology-id="' + entity['id'] + '">', relation, ': ',
		links ? '<i class="fi-arrow-up large"></i> ' : '',
		' <a href="#', entity['id'], '">' + entity['uiLabel'] + ' <i class="fi-magnifying-glass large"></i></a>',

		'</li>'].join('')
}


/*********** ENTITY SHOPPING CART *************************/
function cartCheck(ontologyId) {
	/* A user can select as many entities as they like, but may find that 
	some components of some entities are undesirable.  This script enables
	the shopping list to be maintained with the ability to select entities,
	and also select underlying entities or fields to omit.
	*/
	// Clear out initial help message:	
	if ($('#shoppingCart div.cart-item').length == 0)
		$("#panelCart > div.infoBox").remove()

	var dataId = '[' + getIdHTMLAttribute(ontologyId) +']'
	var items = $('div.cart-item' + dataId + ',div.field-wrapper' + dataId)
	var formItem = $('#mainForm div.field-wrapper' + dataId)
	var cartItem = $('#shoppingCart div.cart-item' + dataId)

	if (cartItem.length == 0) {
		// ADD item to shopping list; couldn't possibly have clicked on it there.

		// Place this new item under parent in cart if it exists
		var path = ontologyId.substr(0, ontologyId.lastIndexOf('/'))
		while (path.length) {
			var item = $('#shoppingCart div.cart-item[data-ontology-id="' + path+ '"]')
			if (item.length) {
				$(item).append(renderCartItem(ontologyId))
				break;
			}
			path = path.substr(0, path.lastIndexOf('/'))
		}

		if (path == '') {// item parent wasn't found
			$("#shoppingCart").prepend(renderCartItem(ontologyId))
			// Issue is that some of remaining items might be positioned under top-level
		}
		var cartItem = $('#shoppingCart div.cart-item' + dataId)
		items = items.add(cartItem)  // x.add() is immutable.

		// See if any existing items (longer ids) fit UNDER  new item
		$('#shoppingCart div.cart-item').each(function(index) {
			var id = $(this).attr('data-ontology-id')
			if (id != ontologyId) {
				if (id.substr(0, ontologyId.length) == ontologyId) 
					$(cartItem).append(this)
			}
		})

	}

	if (formItem.length == 0) {//User has displayed a different form than shoppingList selection pertains to.
		if (cartItem.is('.include'))
			cartItem.removeClass('include').addClass('exclude')
		else if (cartItem.is('.exclude'))
			cartItem.remove()
		return
	}

	// AN ITEM has a state or INHERITS STATE OF ITS FIRST STATED ANCESTOR.
	if (! formItem.is('.exclude, .include')) {
		formItem = formItem.parents('.exclude, .include').first()
		if (formItem.length == 0) {// then this is truly unselected.
			items.addClass('include')
			itemAnimate('#shoppingCartIcon', 'attention')
			return
		}
	}
	if (formItem.is('.exclude')) {
		// Item on exclusion list, so drop it entirely
		items.removeClass('exclude')
		// And remove all markings on subordinate items
		var mainFormEntity = $('#mainForm div.field-wrapper' + dataId)
		mainFormEntity.add(mainFormEntity.find('div.field-wrapper')).removeClass('include, exclude')
		cartItem.remove()
	}
	else if (formItem.is('.include')) {
		// ITEM already in shopping list so downgrade to "exclude" list.
		items.removeClass('include').addClass('exclude')
		itemAnimate('#shoppingCartIcon', 'attention')
	}
}

function itemAnimate(item, effectClass) {
	// Apply given css effectClass to given DOM item for 1 second
	$(item).addClass(effectClass)
	setTimeout('$("'+item+'").removeClass("'+effectClass+'")', 1000)
}

function renderCartItem(ontologyId) {
	// NavFlag enables display of up-arrows that user can click on
	// to navigate to an item's parent.
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.data['specifications'][entityId]
	if (!entity) entity = top.data['picklists'][entityId]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED]'}
	return ['<div class="cart-item" ', getIdHTMLAttribute(ontologyId), '>',
		'<i class="fi-shopping-cart"></i>',
		'<a href="#', ontologyId, '">',	entity['uiLabel'], '</a></div>'].join('')
}


function renderCartObj(ontologyId) {
	// This version of renderCartItem is optimized for sorting, and is used in
	// search results page.  It also provides icons for navigating to an item's parent.
	var ptr = ontologyId.lastIndexOf('/')
	// Get last path item id.
	var entityId = ptr ? ontologyId.substr(ptr+1) : ontologyId
	var entity = top.data['specifications'][entityId]
	if (!entity) entity = top.data['picklists'][entityId]
	if (!entity) entity = {'uiLabel':'[UNRECOGNIZED:' + entityId + ']'}
	var html = ['<div class="cart-item" ', getIdHTMLAttribute(ontologyId), '>',
		'<i class="fi-shopping-cart"></i>',
		('parent' in entity) ? '<i class="fi-arrow-up dropdown parent"></i>' : '',
		('member_of' in entity) ? '<i class="fi-arrow-up dropdown member"></i>' : '',
		('part_of' in entity) ? '<i class="fi-arrow-up dropdown part"></i>' : '',
		'<a href="#', ontologyId, '">',	entity['uiLabel'], '</a></div>'].join('')
	
	return [entity['uiLabel'].toLowerCase(),html]

}


function setShoppingCart() {
	// UPDATE SHOPPING CART STATUS in renderEntity()
	$('#mainForm div.field-wrapper').prepend('<i class="fi-shopping-cart"></i>')
	$('#shoppingCart div.cart-item').each(function(index){
		var status = ''
		if ($(this).is('.include')) status = 'include'
		if ($(this).is('.exclude')) status = 'exclude'

		$('#mainForm div.field-wrapper[' + getIdHTMLAttribute($(this)[0].dataset.ontologyId) + ']').addClass(status)
	})
}


/*********** ENTITY MENU RENDERER *************************/
function renderMenu(entityId, depth = 0 ) {
	// WHEN THIS IS CALLED, ACTIVATE ITS TAB

	var html = ""
	var entity = top.data['specifications'][entityId]
	if (entity) {
		if ('parent' in entity && parent['id'] == entityId) {
			console.log("Node: " + entityId + " is a parent of itself and so is not re-rendered.")
			return html
		}

		var hasChildren = ('members' in entity)
		if (depth > 0) 

			html = ['<li class="cart-item" data-ontology-id="',	entityId,'">',
			hasChildren ? '<a href="#">' : '<a href="#'+entityId+'">',
			entity['uiLabel'],
			hasChildren ? ' <i class="fi-magnifying-glass"></i>' : '',
			'</a>'].join('')

		// See if entity has subordinate parts that need rendering:
		if (hasChildren) {
			for (var memberId in entity['members']) {
				// Top level menu items
				if (depth == 0) html += renderMenu(memberId, depth + 1)
				// Deeper menu items
				else html += '<ul class="menu vertical nested">' + renderMenu(memberId, depth + 1) + '</ul>'	//id="'+memberId+'"
			}
		}

		html +=	'</li>'
	}
	return html
}



function getdataSpecification(entityId) {
	/* The entity form is defined by 1 encompassing entity and its parts which are 
	defined in top.data components: specification, picklists and units 
	*/
	$("#helpDataSpecification").remove()
	$("#dataSpecification").html(JSON.stringify(getEntitySpec(null, entityId), null, 2))
}


function setModalCode(obj, header) {
	// This displays the entity json object as an indented hierarchy of text inside html <pre> tag.
	$("#modalEntity >div.row").html('<p><strong>' + header + '</strong></p>\n<pre style="white-space: pre-wrap;">' + JSON.stringify(obj, null, 2) +'</pre>\n' )
	$("#modalEntity").foundation('open') //.foundation()

}

function getEntitySpec(spec, entityId = null, inherited = false) {
	if (spec == null)
		spec = {'specifications':{}, 'picklists':{}, 'units':{} }

	// A spec entity may also be a root element in picklist
	// FUTURE: MAY WANT TO MERGE THESE?
	if (entityId in top.data['picklists'] && inherited == false) {
		var picklistSpec = top.data['picklists'][entityId]
		spec['picklists'][entityId] = picklistSpec
		getEntitySpecItems(spec, picklistSpec, 'members', 'picklists')
	}

	if (entityId in top.data['specifications']) {
		var entity = top.data['specifications'][entityId]
		if (entity) {
			spec['specifications'][entityId] = entity
			
			if (inherited == true) {
				//Entity inherits 'part_of' ancestors' parts. 
				var parentId = entity['parent']
				if (parentId != 'obo:OBI_0000658') //Top level spec.
					getEntitySpec(spec, parentId, true)
			}

			getEntitySpecItems(spec, entity, 'parts', 'specifications')
			getEntitySpecItems(spec, entity, 'members', 'specifications') 
			// Though a member might not lead to a form element of any kind, still include?
			getEntitySpecItems(spec, entity, 'units', 'units')

		}
	}

	return spec
}

function getEntitySpecItems(spec, entity, type, table, inherited = false) {
	if (type in entity) {
		if (table == 'units') //WHY? table of ids?!
			for (var ptr in entity[type]) {
				var partId = entity[type][ptr]
				spec[table][partId] = top.data[table][partId]
				getEntitySpec(spec, partId)
			}
		else
			for (var partId in entity[type]) {
				spec[table][partId] = top.data[table][partId]
				getEntitySpec(spec, partId)
			}
	}
}



function initFoundation() {

	Foundation.Abide.defaults.live_validate = true // validate the form as you go
	Foundation.Abide.defaults.validate_on_blur = true // validate whenever you focus/blur on an input field
	focus_on_invalid : true, // automatically bring the focus to an invalid input field
	Foundation.Abide.defaults.error_labels = true, // labels with a for="inputId" will recieve an `error` class
	// the amount of time Abide will take before it validates the form (in ms). 
	// smaller time will result in faster validation
	Foundation.Abide.defaults.timeout = 1000
	Foundation.Abide.defaults.patterns = {
		alpha: /^[a-zA-Z]+$/,
		alpha_numeric : /^[a-zA-Z0-9]+$/,
		integer: /^[-+]?\d+$/,
		number: /^[-+]?[1-9]\d*$/,
		decimal: /^[-+]?[1-9]\d*.\d+$/,

		// http://www.whatwg.org/specs/web-apps/current-work/multipage/states-of-the-type-attribute.html#valid-e-mail-address
		email : /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/,

		url: /(https?|ftp|file|ssh):\/\/(((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-zA-Z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-zA-Z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?/,
		// abc.de
		domain: /^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,6}$/,

		datetime: /([0-2][0-9]{3})\-([0-1][0-9])\-([0-3][0-9])T([0-5][0-9])\:([0-5][0-9])\:([0-5][0-9])(Z|([\-\+]([0-1][0-9])\:00))/,
		// YYYY-MM-DD
		date: /(?:19|20)[0-9]{2}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1[0-9]|2[0-9])|(?:(?!02)(?:0[1-9]|1[0-2])-(?:30))|(?:(?:0[13578]|1[02])-31))/,
		// HH:MM:SS
		time : /(0[0-9]|1[0-9]|2[0-3])(:[0-5][0-9]){2}/,
		dateISO: /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/,
	      // MM/DD/YYYY
	      month_day_year : /(0[1-9]|1[012])[- \/.](0[1-9]|[12][0-9]|3[01])[- \/.](19|20)\d\d/,
	}
}
