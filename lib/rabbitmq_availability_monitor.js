//node rabbitmq-availability-monitor.js 1442 "1,1" 192.168.69.130 5672 "guest" "guest"

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = ("Wrong number of parameters.");
}
InvalidParametersNumberError.prototype = Error.prototype;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = ("Invalid value in metric state.");
}
InvalidMetricStateError.prototype = Error.prototype;


// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		console.log(err.message);
		process.exit(1);
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 6)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	var targetUUID = args[0];
	
	//metric state
	var metricState = args[1].replace("\"", "");
	
	var tokens = metricState.split(",");

	var checkStatus = false;
	var checkTimeout = false;
	
	if (tokens.length == 2)
	{
		if (tokens[0] == "1")
		{
			checkStatus = true;
		}

		if (tokens[1] == "1")
		{
			checkTimeout = true;
		}
	}
	else
	{
		throw new InvalidMetricStateError();
	}
	
	
	//host
	var hostname = args[2];
	
	//port
	var port = args[3];
	
	
	// Username
	var username = args[4];
	username = username.length === 0 ? "" : username;
	
	// Password
	var passwd = args[5];
	passwd = passwd.length === 0 ? "" : passwd;
	
	
	if(username === '{0}')
	{
		username = passwd = "";
	}
	
	var connectionURI = "";

	if (username.length == 0)
	{
		connectionURI = "amqp://" + hostname + ":" + port;
	}
	else
	{
		connectionURI = "amqp://" + username + ":" + passwd + "@" + hostname + ":" + port;
	}

	
	var requests = []
	
	var request = new Object()
	request.connectionURI = connectionURI;
	request.targetUUID = targetUUID;
	request.checkStatus = checkStatus;
	request.checkTimeout = checkTimeout;
	
	requests.push(request)

	//console.log(JSON.stringify(requests));
	
	monitorRabbitAvailability(requests);
	
}




//################### OUTPUT ###########################

function output(metrics, targetId)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += new Date(metric.ts).toISOString();
		out += "|";
		out += metric.id;
		out += "|";
		out += targetId;
		out += "|";
		out += metric.val
		
		console.log(out);
	}
}



// ################# MONITOR ###########################
function monitorRabbitAvailability(requests) 
{
	var amqp = require('amqp');
	
	for(var i in requests)
	{
		var request = requests[i];
		
		var start = Date.now();
		
		var conn = amqp.createConnection({url: request.connectionURI}, {reconnect: false});
		
		var metrics = [];
		
		
		conn.on('ready', function () {
			
			conn.socket.destroy();
			
			if (request.checkStatus) {
			
				var metric = new Object();
				metric.id = '178:9';
				metric.val = '1';
				metric.ts = start;
				metric.exec = Date.now() - start;
				
				metrics.push(metric);
			}
			
			if (request.checkTimeout) {
				var metric = new Object();
				metric.id = '75:4';
				metric.val = Date.now() - start;
				metric.ts = start;
				metric.exec = Date.now() - start;
				
				metrics.push(metric);
			}
			
			
			output(metrics, request.targetUUID);
			
		});
		
		
		conn.on('error', function (err) {

			var metric = new Object();
			metric.id = '178:9';
			metric.val = '0';
			metric.ts = start;
			metric.exec = Date.now() - start;
			
			metrics.push(metric);
		
			output(metrics, request.targetUUID);
		});
		
		
		
	}
	
    
}