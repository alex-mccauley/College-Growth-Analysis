/********************************************************
*	Alex McCauley April 2015: modification of 													*
* 	dj.js example using Yelp Kaggle Test Dataset		*
* 	Eamonn O'Loughlin 9th May 2013 						*
*   website: https://becomingadatascientist.wordpress.com/tag/crossfilter-js/ *
*														*
********************************************************/

/********************************************************
*														*
* 	Step0: Load data from json file						*
*														*
********************************************************/
d3.json("./static/data/output_with_enrollments_and_fields.json", function (test_data){	

/* Coerce rental periods to date/time format */
var dateFormat = d3.time.format("%Y-%m");
test_data.forEach(function(d) {
		d["rental_time"] = dateFormat.parse(d["rental_time"]);		
	});
/********************************************************
*														*
* 	Step1: Create the dc.js chart objects & ling to div	*
*														*
********************************************************/

var sizeChart = dc.barChart("#dc-bar-chart");
var bubbleChart = dc.bubbleChart("#dc-bubble-graph");
var pieChart = dc.pieChart("#dc-pie-graph");
var volumeChart = dc.barChart("#dc-volume-chart");
var lineChart = dc.lineChart("#dc-line-chart");
var dataTable = dc.dataTable("#dc-table-graph");
var rowChart = dc.rowChart("#dc-row-graph");

/********************************************************
*														*
* 	Step2:	Run data through crossfilter				*
*														*
********************************************************/
var ndx = crossfilter(test_data);
	
/********************************************************
*														*
* 	Step3: 	Create Dimension that we'll need			*
*														*
********************************************************/

	// plotting number of colleges vs (binned) enrollment size
	var sizeDimension = ndx.dimension(function (d){
		return Math.round(+d["mean"]/1.0e3);
	});
	var sizeGroup = sizeDimension.group();


	// for volumechart
	var nameDimension = ndx.dimension(function (d) {return d["name"]});
	var nameGroup = nameDimension.group(); // Group based on key = name
	var nameDimensionGroup = nameDimension.group().reduce( // define add/remove/initial functions
		// add
		function (p,v){
			++p.count;
			p.mean_sum += v.mean;
			p.percent_growth_sum += v.percent_growth;
			p.rent_growth_rate_sum += v.rent_growth_rate;

			p.mean_avg = p.mean_sum / p.count;
			p.percent_growth_avg = p.percent_growth_sum / p.count;
			p.rent_growth_rate_avg = p.rent_growth_rate_sum / p.count;
			return p;
		},
		// remove
		function (p,v){
			--p.count;
			p.mean_sum -= v.mean;
			p.percent_growth_sum -= v.percent_growth;
			p.rent_growth_rate_sum -= v.rent_growth_rate;

			p.mean_avg = p.mean_sum / p.count;
			p.percent_growth_avg = p.percent_growth_sum / p.count;
			p.rent_growth_rate_avg = p.rent_growth_rate_sum / p.count;
			return p;
		},
		// init
		function (p,v){
			return {count:0, mean_sum: 0, percent_growth_sum: 0, rent_growth_rate_sum:0 };
		}
	);
	
	// line chart: enrollments vs year	
	var yearDimension = ndx.dimension(function (d){
		return d["year"];
	});

	var yearGroup = yearDimension.group();
	var yearDimensionGroup = yearDimension.group().reduce(
		// add
		function (p,v){
			++p.count;
			p.enrollment += v.enrollment;
			return p;
		},
		// subtract
		function (p,v){
			++p.count;
			p.enrollment -= v.enrollment;
			return p;
		},
		// init
		function (p,v){
			return {count:0, enrollment: 0};
		}
	);

	var totalEnrollmentsByYear = yearDimension.group().reduceSum(function (d) {
		return d["enrollment"]/54.0;
	});

	var fieldDimension = ndx.dimension(function (d){
		return d["field_type"];
	});
	var fields_total = fieldDimension.group().reduceSum(function (d){
		return d["field_total"];
	});

	var rentDimension = ndx.dimension(function (d){
		return d["rental_time"];
	});
	var rent_sqft = rentDimension.group().reduceSum(function (d){
		return d["rent"]*54;
	});
/********************************************************
*														*
* 	Step4: Create the Visualisations					*
*														*
********************************************************/
sizeChart.width(900)
		.height(100)
		.transitionDuration(1500)
		.dimension(sizeDimension)
		.group(sizeGroup)
		.x(d3.scale.linear().domain([0,30]))
		.elasticX(false)
		.elasticY(true);

 bubbleChart.width(900)
			.height(500)
			.dimension(nameDimension)
			.group(nameDimensionGroup)
			.transitionDuration(1500)
			.colors(["#a60000","#ff0000", "#ff4040","#ff7373","#67e667","#39e639","#00cc00"])
			.colorDomain([-12000, 12000])
		
			.x(d3.scale.linear().domain([-0.05, 0.1]))			
			.y(d3.scale.linear().domain([-0.1, 0.15]))			
			.r(d3.scale.linear().domain([1, 50]))
			.keyAccessor(function (p) {
				return p.value.percent_growth_avg;
			})
			.valueAccessor(function (p) {
				return p.value.rent_growth_rate_avg;
			})
			.radiusValueAccessor(function (p) {
				return p.value.mean_avg/10000;
			})
			.colorAccessor(function (p){ 
				return p.value.mean_sum/1e2;
			})
			.transitionDuration(1500)
			.elasticX(false)
			.elasticY(false) 
			.yAxisPadding(1)
			.xAxisPadding(1)
			.label(function (p) {
				return p.key;
				})
			.renderLabel(true) 
			.renderlet(function (chart) {
		        rowChart.filter(chart.filter());
		    })
		    .on("postRedraw", function (chart) {
		        dc.events.trigger(function () {
		            rowChart.filter(chart.filter());
		        });
			            });
		    ;

pieChart.width(200)
		.height(200)
		.transitionDuration(1500)
		.dimension(fieldDimension)
		.group(fields_total)
		.radius(90)
		.minAngleForLabel(0)
		.label(function(d) { return d.data.key; })
		.on("filtered", function (chart) {
			dc.events.trigger(function () {
				if(chart.filter()) {
					console.log(chart.filter());
					volumeChart.filter([chart.filter()-.25,chart.filter()-(-0.25)]);
					}
				else volumeChart.filterAll();
			});
		});

var minDate = rentDimension.bottom(1)[0]["rental_time"];
var maxDate = rentDimension.top(1)[0]["rental_time"];

volumeChart.width(270)
            .height(200)
            .dimension(rentDimension)
            .group(rent_sqft)
			.transitionDuration(1500)
            .centerBar(true)	
			.gap(17)
            .x(d3.time.scale().domain([minDate, maxDate]))
			.elasticY(true)
			.on("filtered", function (chart) {
				dc.events.trigger(function () {
					if(chart.filter()) {
						console.log(chart.filter());
						lineChart.filter(chart.filter());
						}
					else
					{lineChart.filterAll()}
				});
			})
			.valueAccessor(function (d) {
				return +d.value/1e3;
			})
			.xAxis().tickFormat(function(v) {return v;});	

lineChart.width(270)
		.height(200)
		.dimension(yearDimension)
		.group(totalEnrollmentsByYear)
		.x(d3.scale.linear().domain([2009.5, 2013.5]))
		.y(d3.scale.linear())
		.valueAccessor(function(d) {
			return +d.value/1e3; // units of 1k students
			})
			.renderHorizontalGridLines(true)
		.elasticY(true)
		.elasticX(true)

/********************************************************
*														*
* 	Step6: 	Render the Charts							*
*														*
********************************************************/
			
	dc.renderAll();
});
