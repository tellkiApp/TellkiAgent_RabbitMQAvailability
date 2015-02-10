
var statusId = "178:Status:9";
var responseTimeId = "75:Response Time:7"

//####################### EXCEPTIONS ################################

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function InvalidMetricStateError() {
    this.name = "InvalidMetricStateError";
    this.message = "Invalid value in metric state.";
	this.code = 9;
}
InvalidMetricStateError.prototype = Object.create(Error.prototype);
InvalidMetricStateError.prototype.constructor = InvalidMetricStateError;


function ConnectionOrAuthenticationError() {
    this.name = "ConnectionOrAuthenticationError";
    this.message = "Connection closed unexpectedly or invalid authentication.";
	this.code = 24;
}
ConnectionOrAuthenticationError.prototype = Object.create(Error.prototype);
ConnectionOrAuthenticationError.prototype.constructor = ConnectionOrAuthenticationError;


var timeout = true;

// ############# INPUT ###################################

(function() {
	try
	{
		monitorInput(process.argv.slice(2));
	}
	catch(err)
	{	
		if(err instanceof InvalidParametersNumberError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else if(err instanceof InvalidMetricStateError)
		{
			console.log(err.message);
			process.exit(err.code);
		}
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)



function monitorInput(args)
{
	
	if(args.length != 5)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


function monitorInputProcess(args)
{
	//metric state
	var metricState = args[0].replace("\"", "");
	
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
	var hostname = args[1];
	
	//port
	var port = args[2];
	
	
	// Username
	var username = args[3];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// Password
	var passwd = args[4];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	
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
	request.checkStatus = checkStatus;
	request.checkTimeout = checkTimeout;
	request.hostname = hostname;
	request.username = username;
	request.passwd = passwd;
	request.port = port;
	
	requests.push(request)
	
	monitorRabbitAvailability(requests);
	
}




//################### OUTPUT ###########################

function output(metrics)
{
	for(var i in metrics)
	{
		var out = "";
		var metric = metrics[i];
		
		out += metric.id;
		out += "|";
		out += metric.val
		out += "|";
		
		console.log(out);
	}
	
	process.exit(0);
}


function errorHandler(err)
{
	if(err instanceof ConnectionOrAuthenticationError)
	{
		console.log(err.message);
		process.exit(err.code);
	}
	
	else
	{
		console.log(err.message);
		process.exit(1);
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
		
		var options = { host: request.hostname
			, port: request.port
			, login: request.username
			, password: request.passwd
		}
		
		var conn = amqp.createConnection(options, {reconnect: false});
		
		var metrics = [];
		
		conn.on('connect', function(){
		
			setTimeout(function () {
				
				conn.socket.destroy();
				
				if(timeout)
				{	
					var metric = new Object();
					metric.id = statusId;
					metric.val = '0';
					metric.ts = start;
					metric.exec = Date.now() - start;
					
					metrics.push(metric);
				
					output(metrics);
				}
				
			}, 50000)
		})
		
		conn.on('ready', function () {
			
			timeout = false;
			
			conn.socket.destroy();
			
			if (request.checkStatus) {
			
				var metric = new Object();
				metric.id = statusId;
				metric.val = '1';
				metric.ts = start;
				metric.exec = Date.now() - start;
				
				metrics.push(metric);
			}
			
			if (request.checkTimeout) {
				var metric = new Object();
				metric.id = responseTimeId;
				metric.val = Date.now() - start;
				metric.ts = start;
				metric.exec = Date.now() - start;
				
				metrics.push(metric);
			}
			
			output(metrics);
			
		});
		
		
		conn.on('error', function (err) {
			
			if(err.code === 'ECONNRESET')
			{
				errorHandler(new ConnectionOrAuthenticationError());
			}
			
			var metric = new Object();
			metric.id = statusId;
			metric.val = '0';
			metric.ts = start;
			metric.exec = Date.now() - start;
			
			metrics.push(metric);
		
			output(metrics);
		});
		
		
		
	}
	
    
}