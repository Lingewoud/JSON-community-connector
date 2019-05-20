//  Copyright notice
//
//  (c) 2019 Gabriël Ramaker <gabriel@lingewoud.nl>, Lingewoud
//
//  All rights reserved
//
//  This script is free software; you can redistribute it and/or modify
//  it under the terms of the GNU General Public License as published by
//  the Free Software Foundation; either version 3 of the License, or
//  (at your option) any later version.
//
//  The GNU General Public License can be found at
//  http://www.gnu.org/copyleft/gpl.html.
//
//  This script is distributed in the hope that it will be useful,
//  but WITHOUT ANY WARRANTY; without even the implied warranty of
//  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//  GNU General Public License for more details.
//
//  This copyright notice MUST APPEAR in all copies of the script!

var connector                 = connector || {};
var connector.cacheExpTime    = 60;
var connector.cacheTag        = 'JSONResults';

function sendUserError( message ) {
  var cc = DataStudioApp.createCommunityConnector();
      cc.newDebugError()
        .setText( message )
        .throwException();
}

function getAuthType() {
  return { type: 'NONE' };
}

function isAdminUser() {
  return false;
}

function getConfig( request ) {
  var cc      = DataStudioApp.createCommunityConnector();
  var config  = cc.getConfig();

  config.newInfo()
    .setId( 'instructions' )
    .setText( 'Fill out the form to connect to a JSON data source. Nested JSON data is not supported. ' );

  config.newTextInput()
    .setId( 'url' )
    .setName( 'Enter the URL of a JSON data source' )
    .setHelpText( 'e.g. https://my-url.org/json')
    .setPlaceholder( 'https://my-url.org/json' );

  config.setDateRangeRequired( false );

  return config.build();
}

function getCachedData( url ) {
  var cache       = CacheService.getUserCache();
  var cachedData  = cache.get( connector.cacheKey );

  if ( cachedData !== null ) {
    var response = cachedData;
  } else {
    try {
      var response = UrlFetchApp.fetch( url );
    } catch (e) {
      sendUserError( '"' + url + '" returned an error' );
    }

    cache.put(connector.cacheKey, response, connector.cacheExpiration);
  }
  return response;
}

function fetchData( url ) {
  if ( !url || !url.match( /^https?:\/\/.+$/g ) ) sendUserError( '"' + url + '" is not a valid url.' );

  var response  = getCachedData( url );
  var content   = JSON.parse( response )

  if ( !content ) sendUserError( '"' + url + '" returned no content.' );

  return content;
}

function getFields( request, content ) {
  var cc            = DataStudioApp.createCommunityConnector();
  var fields        = cc.getFields();
  var types         = cc.FieldType;
  var aggregations  = cc.AggregationType;

  Object.keys( content[0] ).forEach( function( key ) {
    var isNumeric   = !isNaN( parseFloat( content[0][ key] ) ) && isFinite( content[0][ key] );
    var field       = ( isNumeric ) ? fields.newMetric() : fields.newDimension();

    field.setType( ( isNumeric ) ? types.NUMBER : types.TEXT );
    field.setId( key.replace(/\s/g, '_' ).toLowerCase() );
    field.setName( key );
  } );

  return fields;
}

function getSchema( request ) {
  var content   = fetchData( request.configParams.url );
  var fields    = getFields( request, content ).build();

  return { schema: fields };
}

function getColumns(  content, requestedFields ) {
    return content.map(function( row ) {
    var rowValues = [];

    requestedFields.asArray().forEach(function ( field ) {
      rowValues.push( row[ field.getId() ]);
    });

    return { values: rowValues };
  });
}

function getData( request ) {
  var content           = fetchData( request.configParams.url );
  var fields            = getFields( request, content );
  var requestedFieldIds = request.fields.map( function( field ) { return field.name; } );
  var requestedFields   = fields.forIds( requestedFieldIds );

  return {
    schema: requestedFields.build(),
    rows: getColumns(  content, requestedFields )
  };
}
