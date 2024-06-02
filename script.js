google.charts.load("current", { packages: ["corechart"] });

async function initMap() {
  const mapElement = document.getElementById("map");

  let map;
  const { Map } = await google.maps.importLibrary("maps");
  map = new Map(mapElement, {
    zoom: 15,
    center: { lat: 18.5204, lng: 73.8567 },
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
    service: new google.maps.DistanceMatrixService(),

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

            const route = response.routes[0].overview_path;
            const totalDistance =
              google.maps.geometry.spherical.computeLength(route);

            // console.log("Total Distance: ", totalDistance);

            const interpolatePoint = (path, distance) => {
              const interpolatePath = [];

              const pathLengthMinusOne = path.length - 1;
              for (let i = 0; i < pathLengthMinusOne; i++) {
                const segmentDistance =
                  google.maps.geometry.spherical.computeDistanceBetween(
                    path[i],
                    path[i + 1]
                  );

                const numPoints = Math.ceil(segmentDistance / distance);
                const numSegment = segmentDistance / distance;

                for (let j = 0; j < numPoints; j++) {
                  const fraction = j / numSegment;

                  const point = google.maps.geometry.spherical.interpolate(
                    path[i],
                    path[i + 1],
                    fraction
                  );
                  interpolatePath.push(point);
                }
              }
              interpolatePath.push(path[path.length - 1]); //add the last point

              return interpolatePath;
            };

            //Distance between co-ordinates
            const disbetpoints = (points) => {
              const distance = [0];
              let calDistance = 0;

              const pointLength = points.length - 1;
              for (let i = 0; i < pointLength; i++) {
                calDistance +=
                  google.maps.geometry.spherical.computeDistanceBetween(
                    points[i],
                    points[i + 1]
                  );

                distance.push(calDistance);
              }
              return distance;
            };

            const interpolatedPoints = interpolatePoint(route, 1); // 1 meter

            const interpolatedCoordinates = interpolatedPoints.map((point) => ({
              lat: point.lat(),
              lng: point.lng(),
            }));

            const interpolatedDistances = disbetpoints(interpolatedCoordinates);

            const interpolatedData = {
              path: interpolatedPoints,
              distance: interpolatedDistances,
            };

            // console.log("Co-ordiantes: ", interpolatedCoordinates);
            // console.log("Distance: ", interpolatedDistances);

            getPathElevation(interpolatedData, totalDistance);
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

function getPathElevation(data, sample) {
  const path = data.path;
  const elevator = new google.maps.ElevationService();
  const chunkSize = 500; // Adjust chunk size as needed (meters), max: 512
  const elevations = [];
  const sampleSet = Math.ceil(sample / chunkSize);

  function processChunk(chunk) {
    const request = {
      path: chunk.path,
      samples: chunk.samples, // max path can be 512
    };

    elevator.getElevationAlongPath(request, function (results, status) {
      if (status === "OK") {
        elevations.push(...results.map((result) => result.elevation));

        if (request.samples < chunkSize) {
          plotElevationChart(elevations, data.distance);
        }
      } else {
        console.error("Failed to get elevation for chunk:", status);
      }
    });
  }

  // Loop through path coordinates in chunks
  for (let i = 0; i < sampleSet; i++) {
    const pathChunk =
      sampleSet - i == 1
        ? path.slice(i * chunkSize)
        : path.slice(i * chunkSize, (i + 1) * chunkSize);
    const sampleChunk = Math.min(sample, chunkSize);
    const chunk = {
      path: pathChunk,
      samples: sampleChunk,
    };
    sample -= sampleChunk;

    processChunk(chunk);
  }
}

// function plotElevationChart(elevationData, distances) {
//   // const { distances, elevations: elevationD } = elevationData;
//   const data = [
//     ["Distance", "Elevation"],
//     ...distances.map((distance, index) => [distance, elevationData[index]]),
//   ];

//   console.log(data);
// }

function plotElevationChart(elevationData, distances) {
  const data = [
    ["Distance", "Elevation"],
    ...distances.map((distance, index) => [distance, elevationData[index]]),
  ];

  google.charts.setOnLoadCallback(drawChart);
  function drawChart() {
    var dataTable = google.visualization.arrayToDataTable(data);
    var chartDiv = document.getElementById("elevation-chart");

    var options = {
      title: "Elevation Chart",
      vAxis: {
        minValue: 0,
        title: "Elevation (m)",
        gridlines: { color: "#FFFFFF" },
      },
      // curveType: "function",
      hAxis: { title: "Distance (m)", gridlines: { color: "#FFFFFF" } },
      legend: "none",
    };

    var chart = new google.visualization.AreaChart(chartDiv);
    chart.draw(dataTable, options);
  }
}
initMap();
