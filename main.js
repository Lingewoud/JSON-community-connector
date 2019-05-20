function sendUserError( message ) {
  var cc = DataStudioApp.createCommunityConnector();
      cc.newDebugError()
        .setText( message )
        .throwException();
}

function getAuthType() {
  return { type: 'NONE' };
}

function getConfig( request ) {
  var cc      = DataStudioApp.createCommunityConnector();
  var config  = cc.getConfig();

  config.newInfo()
    .setId( 'instructions' )
    .setText( 'Fetch JSON data' );

  config.newTextInput()
    .setId( 'url' )
    .setName( 'Enter the JSON URL' )
    .setHelpText( 'e.g. https://my-url.org/json')
    .setPlaceholder( 'https://my-url.org/json' );

  config.setDateRangeRequired( false );

  return config.build();
}

function fetchData( url ) {
  if ( !url || !url.match( /^https?:\/\/.+$/g ) ) sendUserError( '"' + url + '" is not a valid url.' );

  var response  = UrlFetchApp.fetch( url );
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
