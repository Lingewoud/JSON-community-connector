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

function sendUserError( message ) {
  var cc = DataStudioApp.createCommunityConnector();
      cc.newUserError()
        .setText( message )
        .throwException();

  console.log(message);
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

  config.newCheckbox()
    .setId( 'cache' )
    .setName( 'Cache response' )
    .setHelpText( 'Usefull with big datasets. Response is cached for 10 minutes')
    .setAllowOverride(true);

  config.setDateRangeRequired( false );

  return config.build();
}

function fetchJSON( url ) {
  try {
    var response = UrlFetchApp.fetch( url );
  } catch ( e ) {
    sendUserError( '"' + url + '" returned an error:' + e );
  }

  try {
    var content   = JSON.parse( response )
  } catch( e ) {
    sendUserError( 'Invalid JSON format:' + e );
  }

  return content;
}

function getCachedData( url ) {
  var cacheExpTime    = 600;
  var cache           = CacheService.getUserCache();
  var cacheKey        = url.replace(/[^a-zA-Z0-9]+/g, '');
  var cacheKeyString  = cache.get( cacheKey + '.keys' );
  var cacheKeys       = ( cacheKeyString !== null ) ? cacheKeyString.split( ',' ) : [];
  var cacheData       = {};
  var content         = [];


  if( cacheKeyString !== null && cacheKeys.length > 0 ) {
    cacheData = cache.getAll( cacheKeys );

    for ( var key  in cacheKeys ) {
      if( cacheData[ cacheKeys[key] ] != undefined ) content.push( JSON.parse( cacheData[ cacheKeys[key] ] ) );
    }
  } else {
    content    = fetchJSON( url );

    for ( var key  in content ) {
      cacheData[ cacheKey + '.' + key ] = JSON.stringify( content[ key ] );
    }

    cache.putAll( cacheData );
    cache.put( cacheKey + '.keys', Object.keys( cacheData ), cacheExpTime );
  }

  return content;
}

function fetchData( url, cache ) {
  if ( !url || !url.match( /^https?:\/\/.+$/g ) ) sendUserError( '"' + url + '" is not a valid url.' );

  var content  = ( cache ) ? getCachedData( url ) : fetchJSON( url );

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
  var content   = fetchData( request.configParams.url, request.configParams.cache );
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
  var content           = fetchData( request.configParams.url, request.configParams.cache  );
  var fields            = getFields( request, content );
  var requestedFieldIds = request.fields.map( function( field ) { return field.name; } );
  var requestedFields   = fields.forIds( requestedFieldIds );

  return {
    schema: requestedFields.build(),
    rows: getColumns(  content, requestedFields )
  };
}
