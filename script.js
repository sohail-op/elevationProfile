google.charts.load("current", { packages: ["corechart"] });

async function initMap() {
  const mapElement = document.getElementById("map");

  let map;
  const { Map } = await google.maps.importLibrary("maps");
  map = new Map(mapElement, {
    zoom: 13,
    center: { lat: 20.2961, lng: 85.8245 },
  });

  autocompleteDirectionsHandler(map);
}

function autocompleteDirectionsHandler(map) {
  const handler = {
    map,
    originPlaceId: "",
    destinationPlaceId: "",
    travelMode: google.maps.TravelMode.DRIVING,
    directionsService: new google.maps.DirectionsService(),
    directionsRenderer: new google.maps.DirectionsRenderer(),

    setupPlaceChangedListener(autocomplete, mode) {
      autocomplete.bindTo("bounds", handler.map);
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.place_id) {
          window.alert("Please select an option from the dropdown list.");
          return;
        }
        if (mode === "ORIG") {
          handler.originPlaceId = place.place_id;
        } else {
          handler.destinationPlaceId = place.place_id;
        }
        handler.route();
      });
    },
    route() {
      if (!handler.originPlaceId || !handler.destinationPlaceId) {
        return;
      }
      handler.directionsService.route(
        {
          origin: { placeId: handler.originPlaceId },
          destination: { placeId: handler.destinationPlaceId },
          travelMode: handler.travelMode,
        },
        (response, status) => {
          if (status === "OK") {
            handler.directionsRenderer.setDirections(response);

            // Extract route coordinates
            const route = response.routes[0].overview_path;
            const pathCoordinates = route.map((point) => ({
              lat: point.lat(),
              lng: point.lng(),
            }));

            // Get elevation for the route coordinates
            getPathElevation(pathCoordinates);
          } else {
            window.alert("Directions request failed due to " + status);
          }
        }
      );
    },
  };

  handler.directionsRenderer.setMap(map);
  const originInput = document.getElementById("origin-input");
  const destinationInput = document.getElementById("destination-input");
  const originAutocomplete = new google.maps.places.Autocomplete(originInput, {
    fields: ["place_id"],
  });
  const destinationAutocomplete = new google.maps.places.Autocomplete(
    destinationInput,
    { fields: ["place_id"] }
  );

  handler.setupPlaceChangedListener(originAutocomplete, "ORIG");
  handler.setupPlaceChangedListener(destinationAutocomplete, "DEST");
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(originInput);
  map.controls[google.maps.ControlPosition.TOP_LEFT].push(destinationInput);

  return handler;
}

function getPathElevation(path) {
  const elevator = new google.maps.ElevationService();

  const request = {
    path: path,
    samples: 256,
  };

  elevator.getElevationAlongPath(request, function (results, status) {
    if (status === "OK") {
      const elevations = [];
      for (let i = 0; i < results.length; i++) {
        elevations.push(results[i].elevation);
      }
      plotElevationChart(elevations);
    } else {
      const chartDiv = document.getElementById("elevation-chart");
      chartDiv.innerHTML = `<p>Unable to get elevation data</p>`;
    }
  });
}

function plotElevationChart(elevationData) {
  const chartDiv = document.getElementById("elevation-chart");

  const data = [
    ["", "Elevation"],
    ...elevationData.map((elevation) => ["", elevation]),
  ];

  google.charts.setOnLoadCallback(drawChart);
  function drawChart() {
    var dataTable = google.visualization.arrayToDataTable(data);

    var options = {
      title: "Elevation Chart",
      vAxis: { minValue: 0 },
      legend: { position: "none" },
    };

    var chart = new google.visualization.AreaChart(chartDiv);
    chart.draw(dataTable, options);
  }
}

initMap();
