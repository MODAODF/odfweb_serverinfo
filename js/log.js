(function ($, OC) {
    var logDiskSpaceChart,
        logCpuLoadChart,
        logFileChart,
        logUserChart,
        logShareUserChart,
        logShareGroupChart,
        logShareLinkChart;

    let dataDiskSpace = null;
    let dataCpuLoad = null;
    let dataFile = null;
    let dataUser = null;
    let dataShareUser = null;
    let dataShareGroup = null;
    let dataShareLink = null;

	$(window).load(function(){ resizeSystemCharts(); });
    $(window).resize(function(){ resizeSystemCharts(); });

    $('#downloadPdf').submit(function(e) {
        e.preventDefault();
        let pdfctxX = 50;
        let pdfctxY = 50;
        const buffer = 100
        const allCanvas = $('.charts-container').find('canvas');

        // Size of pdf page
        const pageHeight = $(allCanvas[0]).innerHeight()*allCanvas.length + buffer*(allCanvas.length+1);
        const pageWidth = $(allCanvas[0]).innerWidth() + buffer;

        // create a new canvas object to populate with all other canvas objects
        let pdfCanvas = $('<canvas />').attr({
            id: "canvaspdf",
            width: pageWidth,
            height: pageHeight,
        });
        let pdfctx = $(pdfCanvas)[0].getContext('2d');

        // pdf title
        const $title = $('#servertitle');
        const headWidth = $title.innerWidth();
        const headHeight = $title.innerHeight();
        const titleX = (pageWidth-headWidth)/2;
        pdfctx.font = 'bold ' + $title.css('font-size') + ' sans-serif';
        pdfctx.fillText($title.text(), titleX, pdfctxY);
        const { width } = pdfctx.measureText($title.text());
        pdfctx.fillRect(titleX, pdfctxY, width+5, 2);
        pdfctxY += headHeight;

        const $time = $('#timestamp');
        const timeWidth = $time.innerWidth();
        const timeHeight = $time.innerHeight();
        const timeX = (pageWidth-timeWidth)/2;
        pdfctx.font = 'normal ' + $time.css('font-size') + ' sans-serif';
        pdfctx.fillStyle = '#515151';
        pdfctx.fillText($time.text(), timeX, pdfctxY);
        pdfctxY += timeHeight + 50;

        allCanvas.each(function() {
            var canvasHeight = $(this).innerHeight();
            var canvasWidth = $(this).innerWidth();
            // draw the chart into the new canvas
            pdfctx.drawImage($(this)[0], pdfctxX, pdfctxY, canvasWidth, canvasHeight);
            pdfctxY += canvasHeight + buffer;
        });

        // create new pdf and add our new canvas as an image
        const { jsPDF } = window.jspdf;
        let pdf = new jsPDF('p', 'pt', [pageWidth/96*72, pageHeight/96*72]); // px/96*72 = pt
        pdf.addImage($(pdfCanvas)[0], 'PNG', 0, 0);

        const filename = $(this).find('input').val() ?? '????????????????????????';
        pdf.save(filename + '.pdf');
    })

    $('#daysNumber').on('input', function() {
        const inputDays = Number(this.value);
        if (!inputDays || inputDays < 1 || inputDays > 90) {
            $('.msg').html('????????????????????? 1-90 ???').show();
            $('button[type=submit]').attr('disabled', 'disabled');
        } else {
            $('button[type=submit]').removeAttr('disabled');
            $('.msg').html('');
        }
    });

    $('button[data]').on('click',function() {
        $('#daysNumber').val($(this).attr('data'))
        $('#searchLogs').submit()
    })

    $('#searchLogs').submit(function(e) {
        e.preventDefault();
        const $msg = $('.msg');
        const $charts = $('.charts-container');
        const $input = $('#daysNumber');
        const $result = $('.result-controller');
        let inputDays = Number($input.val());
        if (!Number.isInteger(inputDays)) {
            inputDays = Math.floor(inputDays);
            $input.val(inputDays);
        }
        if (inputDays === Number($input.attr('prevval'))) {
            $charts.css('opacity', '0.3');
            setTimeout(function(){
                $charts.css("opacity", 'unset');
              }, 150);
            return;
        };

        $.ajax({
            url: OC.generateUrl('/apps/serverinfo/log/' + inputDays),
            type: 'GET',
            context: this,
            beforeSend: function() {
                $charts.css('opacity', '0.3');
                $('.search-wrapper').find('button, input').attr('disabled', 'disabled');
                $result.find('b').html('');
                $result.hide();
                $msg.html('').hide();
            },
        })
        .done(function(resp) {
            $input.attr('prevval', inputDays)
            const resultDate = "???" + resp['days_number'] + "???????????????" + "???" + resp['days_duration'] + "???";
            $result.find('b').html(resultDate);
            $result.show();
            dataDiskSpace = resp["disk_space"];
            dataCpuLoad = resp["cpu_load"];
            dataFile = resp["files_num"];
            dataUser = resp["users_num"];
            dataShareUser = resp["share_user_num"];
            dataShareGroup = resp["share_group_num"];
            dataShareLink = resp["share_link_num"];
            updateCharts();
            $charts.show();
        })
        .fail(function(resp) {
            const msg = resp.responseJSON?.message ?? '????????????????????????';
            $msg.html(msg).show();
            $charts.hide();
        })
        .always(function() {
            $charts.css('opacity', 'unset');
            $('.search-wrapper').find('button, input').removeAttr('disabled');
        });
    })

    const $hideNull = $('#hideNullData');
    let needHide = $hideNull.is(':checked');
    $hideNull.on('change', updateCharts);
    function updateCharts() {
        needHide = $hideNull.is(':checked');
        updateDiskSpace();
        updateCupLoad();
        updateFile();
        updateUser();
        updateShare('user');
        updateShare('group');
        updateShare('link');
    }

    function getThemedPrimaryColor() {
        return OCA.Theming ? OCA.Theming.color : 'rgb(54, 129, 195)';
    }

    function _formatDate(date, fotmatStr) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = Number(d.getMonth()) + 1; // .padStart(2,'0');
        const day = String(d.getDate()) // .padStart(2,'0');
        const hour = String(d.getHours()) //.padStart(2,'0');
        const min = String(d.getMinutes()) // .padStart(2,'0');
        const sec = String(d.getSeconds()) // .padStart(2,'0');
        fotmatStr = fotmatStr.replaceAll(/Y/g, year).replaceAll(/M/g, month).replaceAll(/D/g, day).replaceAll(/h/g, hour).replaceAll(/m/g, min).replaceAll(/s/g, sec);
        return fotmatStr;
    }

    function _formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // X??? ????????????
    function _getScaleTitle(labels) {
        const labelYears = [], labelDays = [];
        labels.forEach(function(el) {
            const y = _formatDate(el, 'Y');
            const ymd = _formatDate(el, 'Y-M-D');
            if( !labelYears.includes(y) ) labelYears.push(y);
            if( !labelDays.includes(ymd) ) labelDays.push(ymd);
        })
        let str = _formatDate(labelDays[0],"??????Y???M???D???") + ' ??? ' + _formatDate(labelDays[labelDays.length-1],"??????Y???M???D???");
        if (labelDays.length === 1) {
            str = _formatDate(labelDays[0], '??????Y???M???D???');
        }
        else if (labelYears.length === 1) {
            str = `??????${labelYears[0]}??????${_formatDate(labelDays[0], 'M???D???')} ??? ${_formatDate(labelDays[labelDays.length-1], 'M???D???')}???`
        }
        return {display:true,text:str};
    }

    // X??? ???????????????
    function _formatLabels(labels) {
        const labelYears = [], labelDays = [];
        labels.forEach(function(el) {
            const y = _formatDate(el, 'Y');
            const ymd = _formatDate(el, 'Y-M-D');
            if( !labelYears.includes(y) ) labelYears.push(y);
            if( !labelDays.includes(ymd) ) labelDays.push(ymd);
        })
        let formatStr = '["Y???M???D???"]';
        if (labelDays.length === 1) formatStr = '["h???m???"]';
        else if (labelDays.length < 4) formatStr = '["M???D???", "h???m???"]';
        else if (labelYears.length === 1) formatStr = '["M???D???"]';
        let res = labels.map(el => JSON.parse(_formatDate(el, formatStr)));
        return res;
    }

    function resizeSystemCharts() {
        const canvasWidth = function(el) {
            const parent = el.parents('.infobox').width() - 30;
            el.width(parent);
            el.attr('width', parent);
        }
        canvasWidth($("#logdiskspacecanvas"));
        canvasWidth($("#logcpuloadcanvas"));
        canvasWidth($("#logfilecanvas"));
        canvasWidth($("#logusercanvas"));
        canvasWidth($("#logshareusercanvas"));
        canvasWidth($("#logsharegroupcanvas"));
        canvasWidth($("#logsharelinkcanvas"));
        updateCharts();
    }

    function _onChartComplete(ctx, chartObj, title) {
        $('.result-controller').show();
        const $a = $(ctx).siblings('.downloadPng').find('a');
        $a.show();
        $a.attr('href', chartObj.toBase64Image());
        $a.attr('download', title + '.png');
    }

    function updateDiskSpace() {
        const dataObj = dataDiskSpace ?? $('#logdiskspacecanvas').data('logs');
        let logData = {'totalSpace':[], 'freeSpace':[]};
        let logLabels = [];
        for (const [key, value] of Object.entries(dataObj)) {
            if (needHide && (value['totalSpace'] === null || value['freeSpace'] === null)) continue;
            logLabels.push(key);
            logData['totalSpace'].push(value['totalSpace']);
            logData['freeSpace'].push(value['freeSpace']);
        }

        const _getTooltipsTitle = (idx) => logLabels[idx];

        let stepSize = Math.max.apply(null, logData['totalSpace'])/5;
		if (typeof logDiskSpaceChart === 'undefined') {
            const canvasTitle = '????????????';
            var ctx = document.getElementById("logdiskspacecanvas");
            var chartConfig = {
				type: 'line',
				options: {
                    animation: {
                        onComplete: function() {
                            _onChartComplete(ctx, logDiskSpaceChart, canvasTitle);
                        }
                    },
                    responsive: true,
                    title: {
                        display: true,
                        text: canvasTitle
                    },
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                label: function(tooltipItem) {
                                    return _formatBytes(tooltipItem.raw);
                                },
                                title: function(tooltipItem) {
                                    return _getTooltipsTitle(tooltipItem[0].dataIndex);
                                }
                            }
                        },
                    },
                    elements: {
                        point: {
                            radius: 0
                        }
                    },
                    scales: {
                        xAxes: {
                            title: _getScaleTitle(logLabels),
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 10,
                                maxRotation: 0,
                            }
                        },
						yAxes: {
                            min: 0,
                            suggestedMax: Math.max.apply(null, logData['totalSpace']) + stepSize,
							ticks: {
                                autoSkip: true,
                                // minTicksLimit: 5,
                                callback: function(value, index, values) {
                                    return _formatBytes(value);
                                },
                            }
                        },
					},
				},
				data: {
                    labels: _formatLabels(logLabels),
					datasets: [
                        {
                            label: "????????????",
                            data: logData['freeSpace'],
                            fill: true,
                            showLine: true,
                            tension: 0.2,
                            backgroundColor: getThemedPrimaryColor(),
                            borderColor: 'rgb(0,0,0,0)',
                        },
                        {
                            label: "?????????",
                            data: logData['totalSpace'],
                            fill: true,
                            showLine: true,
                            tension: 0.2,
                            borderWidth: 2,
                            borderDashOffset: 0.1,
                        },
                    ]
				},
            }
            logDiskSpaceChart = new Chart(ctx, chartConfig);
        } else {
            logDiskSpaceChart.config.data.datasets[0].data = logData['freeSpace'];
            logDiskSpaceChart.config.data.datasets[1].data = logData['totalSpace'];
            logDiskSpaceChart.config.data.labels = _formatLabels(logLabels);
            logDiskSpaceChart.config.options.scales['xAxes'].title = _getScaleTitle(logLabels);
            logDiskSpaceChart.config.options.plugins.tooltip.callbacks.title = (tooltipItem) => _getTooltipsTitle(tooltipItem[0].dataIndex);

            stepSize = (logDiskSpaceChart.scales['y-axis-0']?.ticksAsNumbers[0] - logDiskSpaceChart?.scales['y-axis-0']?.ticksAsNumbers[1]) ?? stepSize;
            logDiskSpaceChart.config.options.scales.yAxes.suggestedMax = Math.max.apply(null, logData['totalSpace']) + stepSize;
        }
        logDiskSpaceChart.update();
    }

    function updateCupLoad() {
		const dataObj = dataCpuLoad ?? $('#logcpuloadcanvas').data('logs')
        const logData = [];
        const logLabels = [];
        for (const [key, value] of Object.entries(dataObj)) {
            if (needHide && value === null) continue;
            logLabels.push(key);
            logData.push(value);
        }

        const _getTooltipsTitle = (idx) => logLabels[idx];

		if (typeof logCpuLoadChart === 'undefined') {
            const canvasTitle = '??????';
            var ctx = document.getElementById("logcpuloadcanvas");
            var chartConfig = {
                type: 'line',
                options: {
                    animation: {
                        onComplete: function() {
                            _onChartComplete(ctx, logCpuLoadChart, canvasTitle);
                        }
                    },
                    responsive: true,
                    title: {
                        display: true,
                        text: canvasTitle,
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(tooltipItem) {
                                    return _getTooltipsTitle(tooltipItem[0].dataIndex);
                                }
                            }
                        },
                    },
                    // hover: {
                    //     mode: 'nearest',
                    //     intersect: true
                    // },
                    elements: {
                        point: {
                            radius: 0
                        }
                    },
                    scales: {
                        xAxes: {
                            title: _getScaleTitle(logLabels),
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 10,
                                maxRotation: 0,
                            }
                        },
                        yAxes: {
                            min: 0,
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 5,
                            }
                        },
                    }
                },
                data: {
                    labels: _formatLabels(logLabels),
                    datasets: [{
                        label: "??????",
                        data: logData,
                        fill: true,
                        fillOpacity: 0.3,
                        tension: 0.2,
                        backgroundColor: getThemedPrimaryColor(),
                        borderColor: 'rgb(0,0,0,0)',
                    }]
                },
            }
			logCpuLoadChart = new Chart(ctx, chartConfig);
		} else {
            logCpuLoadChart.config.data.datasets[0].data = logData;
            logCpuLoadChart.config.data.labels = _formatLabels(logLabels);
            logCpuLoadChart.config.options.scales['xAxes'].title = _getScaleTitle(logLabels);
            logCpuLoadChart.config.options.plugins.tooltip.callbacks.title = (tooltipItem) => _getTooltipsTitle(tooltipItem[0].dataIndex);
        }
		logCpuLoadChart.update();
    }

    function updateFile() {
		const dataObj = dataFile ?? $('#logfilecanvas').data('logs')
        const logData = [];
        const logLabels = [];
        for (const [key, value] of Object.entries(dataObj)) {
            if (needHide && value === null) continue;
            logLabels.push(key);
            logData.push(value);
        }

        const _getTooltipsTitle = (idx) => logLabels[idx];

		if (typeof logFileChart === 'undefined') {
            const canvasTitle = '????????????';
            var ctx = document.getElementById("logfilecanvas");
            var chartConfig = {
                type: 'line',
                options: {
                    animation: {
                        onComplete: function() {
                            _onChartComplete(ctx, logFileChart, canvasTitle);
                        }
                    },
                    responsive: true,
                    title: {
                        display: true,
                        text: canvasTitle,
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(tooltipItem) {
                                    return _getTooltipsTitle(tooltipItem[0].dataIndex);
                                }
                            }
                        },
                    },
                    elements: {
                        point: {
                            radius: 0
                        }
                    },
                    scales: {
                        xAxes: {
                            title: _getScaleTitle(logLabels),
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 10,
                                maxRotation: 0,
                            }
                        },
                        yAxes: {
                            suggestedMax: Math.max.apply(null, logData) + 1,
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 5,
                            }
                        },
                    }
                },
                data: {
                    labels: _formatLabels(logLabels),
                    datasets: [
                        {
                            label: "????????????",
                            data: logData,
                            fill: true,
                            tension: 0.2,
                            backgroundColor: getThemedPrimaryColor(),
                            borderColor: 'rgb(0,0,0,0)',
                        }
                    ]
                },
            }
			logFileChart = new Chart(ctx, chartConfig);
		} else {
            logFileChart.config.data.datasets[0].data = logData;
            logFileChart.config.data.labels = _formatLabels(logLabels);
            logFileChart.config.options.scales['xAxes'].title = _getScaleTitle(logLabels);
            logFileChart.config.options.plugins.tooltip.callbacks.title = (tooltipItem) => _getTooltipsTitle(tooltipItem[0].dataIndex);
        }
		logFileChart.update();
    }

    function updateUser() {
        const dataObj = dataUser ?? $('#logusercanvas').data('logs')
        let logData = { 'totalUser':[], 'hourActiveUser':[] };
        let logLabels = [];
        for (const [key, value] of Object.entries(dataObj)) {
            if (needHide && (value['totalUser'] === null || value['hourActiveUser'] === null)) continue;
            logLabels.push(key);
            logData['totalUser'].push(value['totalUser']);
            logData['hourActiveUser'].push(value['hourActiveUser']);
        }

        const _getTooltipsTitle = (idx) => logLabels[idx];

		let	stepSize = 0;
		if (Math.max.apply(null, logData['totalUser']) < 10) {
			stepSize = 1;
		}

		if (typeof logUserChart === 'undefined') {
            const canvasTitle = '???????????????';
            var ctx = document.getElementById("logusercanvas");
            var chartConfig = {
                type: 'line',
                options: {
                    animation: {
                        onComplete: function() {
                            _onChartComplete(ctx, logUserChart, canvasTitle);
                        }
                    },
                    responsive: true,
                    title: {
                        display: true,
                        text: canvasTitle,
                    },
                    plugins: {
                        tooltip: {
                            mode: 'index',
                            intersect: false,
                            callbacks: {
                                title: function(tooltipItem) {
                                    return _getTooltipsTitle(tooltipItem[0].dataIndex);
                                }
                            }
                        },
                    },
                    elements: {
                        point: {
                            radius: 0
                        }
                    },
                    scales: {
                        xAxes: {
                            title: _getScaleTitle(logLabels),
                            ticks: {
                                autoSkip: true,
                                maxTicksLimit: 10,
                                maxRotation: 0,
                            }
                        },
                        yAxes: {
                            suggestedMax: Math.max.apply(null, logData['totalUser']) + (stepSize === 1 ? 1:5),
                            ticks: {
                                stepSize: stepSize,
                                autoSkip: !(stepSize === 1),
                                maxTicksLimit: 5,
                            }
                        },
                    }
                },
                data: {
                    labels: _formatLabels(logLabels),
                    datasets: [
                        {
                            label: "??????????????????",
                            data: logData['hourActiveUser'],
                            fill: true,
                            showLine: true,
                            tension: 0.2,
                            backgroundColor: getThemedPrimaryColor(),
                            borderColor: 'rgb(0,0,0,0)',
                        },
                        {
                            label: "????????????",
                            data: logData['totalUser'],
                            fill: true,
                            showLine: true,
                            tension: 0.2,
                            borderWidth: 2,
                            borderDashOffset: 0.1,
                        },
                    ]
                },
            }
			logUserChart = new Chart(ctx, chartConfig);
		} else {
            logUserChart.config.data.datasets[0].data = logData["hourActiveUser"];
            logUserChart.config.data.datasets[1].data = logData["totalUser"];
            logUserChart.config.data.labels = _formatLabels(logLabels);
            logUserChart.config.options.scales['xAxes'].title = _getScaleTitle(logLabels);
            logUserChart.config.options.plugins.tooltip.callbacks.title = (tooltipItem) => _getTooltipsTitle(tooltipItem[0].dataIndex);
        }
		logUserChart.update();
    }

    function updateShare(type) {
        let canvasId = null;
        let canvasTitle = '?????????????????????';
        let dataObj = null;
        switch (type) {
            case 'user':
                canvasId = 'logshareusercanvas';
                canvasTitle += ' (?????????)';
                dataObj = dataShareUser ?? $('#' + canvasId).data('logs')
                break;
            case 'group':
                canvasId = 'logsharegroupcanvas';
                canvasTitle += ' (??????)';
                dataObj = dataShareGroup ?? $('#' + canvasId).data('logs')
                break;
            case 'link':
                canvasId = 'logsharelinkcanvas';
                canvasTitle += ' (????????????)';
                dataObj = dataShareLink ?? $('#' + canvasId).data('logs')
                break;
            default:
                return;
        }

        const logData = [];
        const logLabels = [];
        for (const [key, value] of Object.entries(dataObj)) {
            if (needHide && value === null) continue;
            logLabels.push(key);
            logData.push(value);
        }

        const _getTooltipsTitle = (idx) => logLabels[idx];

		let	stepSize = 0;
		if (Math.max.apply(null, logData) < 10) {
			stepSize = 1;
        }

        var chartConfig = {
            type: 'line',
            options: {
                animation: {
                    onComplete: function() {
                        const ctx = document.getElementById(canvasId);
                        if(type === 'user') _onChartComplete(ctx, logShareUserChart, canvasTitle);
                        if(type === 'group') _onChartComplete(ctx, logShareGroupChart, canvasTitle);
                        if(type === 'link') _onChartComplete(ctx, logShareLinkChart, canvasTitle);
                    }
                },
                responsive: true,
                title: {
                    display: true,
                    text: canvasTitle
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function(tooltipItem) {
                                return _getTooltipsTitle(tooltipItem[0].dataIndex);
                            }
                        }
                    },
                },
                elements: {
                    point: {
                        radius: 0
                    }
                },
                scales: {
                    xAxes: {
                        title: _getScaleTitle(logLabels),
                        ticks: {
                            autoSkip: true,
                            maxTicksLimit: 10,
                            maxRotation: 0,
                        }
                    },
                    yAxes: {
                        min: 0,
                        suggestedMax: Math.max.apply(null, logData) + (stepSize === 1 ? 1:5),
                        ticks: {
                            stepSize: stepSize,
                            autoSkip: !(stepSize === 1),
                            maxTicksLimit: 5,
                        }
                    },
                }
            },
            data: {
                labels: _formatLabels(logLabels),
                datasets: [
                    {
                        label: "????????????",
                        data: logData,
                        fill: true,
                        tension: 0.2,
                        backgroundColor: getThemedPrimaryColor(),
                        borderColor: 'rgb(0,0,0,0)',
                    }
                ]
            },
        }

        const newLabelItem = _formatLabels(logLabels);
        if (type === 'user') {
            if (typeof logShareUserChart === 'undefined') {
                var ctx = document.getElementById(canvasId);
                logShareUserChart = new Chart(ctx, chartConfig);
            } else {
                logShareUserChart.config.data.labels = newLabelItem;
                logShareUserChart.config.data.datasets[0].data = logData;
                logShareUserChart.config.options.scales['xAxes'].title = _getScaleTitle(logLabels);
                logShareUserChart.config.options.plugins.tooltip.callbacks.title = (tooltipItem) => _getTooltipsTitle(tooltipItem[0].dataIndex);
            }
            logShareUserChart.update();
        }
        else if (type === 'group') {
            if (typeof logShareGroupChart === 'undefined') {
                var ctx = document.getElementById(canvasId);
                logShareGroupChart = new Chart(ctx, chartConfig);
            } else {
                logShareGroupChart.config.data.labels = newLabelItem;
                logShareGroupChart.config.data.datasets[0].data = logData;
                logShareGroupChart.config.options.scales['xAxes'].title = _getScaleTitle(logLabels);
                logShareGroupChart.config.options.plugins.tooltip.callbacks.title = (tooltipItem) => _getTooltipsTitle(tooltipItem[0].dataIndex);
            }
            logShareGroupChart.update();
        }
        else if (type === 'link') {
            if (typeof logShareLinkChart === 'undefined') {
                var ctx = document.getElementById(canvasId);
                logShareLinkChart = new Chart(ctx, chartConfig);
            } else {
                logShareLinkChart.config.data.labels = newLabelItem;
                logShareLinkChart.config.data.datasets[0].data = logData;
                logShareLinkChart.config.options.scales['xAxes'].title = _getScaleTitle(logLabels);
                logShareLinkChart.config.options.plugins.tooltip.callbacks.title = (tooltipItem) => _getTooltipsTitle(tooltipItem[0].dataIndex);
            }
            logShareLinkChart.update();
        }
    }
})(jQuery, OC);
