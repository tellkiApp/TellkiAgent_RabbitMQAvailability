/**
* This script was developed by Guberni and is part of Tellki's Monitoring Solution
*
* February, 2015
* 
* Version 1.0
*
* DEPENDENCIES:
*		amqp v0.2.0 (https://www.npmjs.com/package/amqp)
* 
* DESCRIPTION: Monitor RabbitMQ Avalability utilization
*
* SYNTAX: node rabbitmq_availability_monitor.js <METRIC_STATE> <HOST> <PORT> <USER_NAME> <PASS_WORD>
* 
* EXAMPLE: node rabbitmq_availability_monitor.js "1,1" "10.10.2.5" "3306" "user" "pass"
*
* README:
*		<METRIC_STATE> is generated internally by Tellki and it's only used by Tellki default monitors.
*		1 - metric is on ; 0 - metric is off
*		
*		<HOST> RabbitMQ ip address or hostname.
*		
*		<PORT> RabbitMQ port
*		
*		<USER_NAME> RabbitMQ user to connect
*		
*		<PASS_WORD> RabbitMQ user password
**/

//METRICS IDS
var statusId = "178:Status:9";
var responseTimeId = "75:Response Time:4";

// ############# INPUT ###################################

//START
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
		else
		{
			console.log(err.message);
			process.exit(1);
		}
	}
}).call(this)


/*
* Verify number of passed arguments into the script.
*/
function monitorInput(args)
{
	
	if(args.length != 5)
	{
		throw new InvalidParametersNumberError()
	}		
	
	monitorInputProcess(args);
}


/*
* Process the passed arguments and send them to monitor execution (monitorRabbitAvailability)
* Receive: arguments to be processed
*/
function monitorInputProcess(args)
{
	//<METRIC_STATE> 
	var metricState = args[0].replace("\"", "");
	
	var tokens = metricState.split(",");

	// metric Status state
	var checkStatus = false;
	// metric Response time state
	var checkTimeout = false;
	
	
	if (tokens[0] == "1")
	{
		checkStatus = true;
	}

	if (tokens[1] == "1")
	{
		checkTimeout = true;
	}
	
	
	//<HOST> 
	var hostname = args[1];
	
	//<PORT> 
	var port = args[2];
	
	
	// <USER_NAME> 
	var username = args[3];
	
	username = username.length === 0 ? "" : username;
	username = username === "\"\"" ? "" : username;
	if(username.length === 1 && username === "\"")
		username = "";
	
	// <PASS_WORD>
	var passwd = args[4];
	
	passwd = passwd.length === 0 ? "" : passwd;
	passwd = passwd === "\"\"" ? "" : passwd;
	if(passwd.length === 1 && passwd === "\"")
		passwd = "";
	
	
	if(username === '{0}')
	{
		username = passwd = "";
	}
	
	//create connection URI
	var connectionURI = "";

	if (username.length == 0)
	{
		connectionURI = "amqp://" + hostname + ":" + port;
	}
	else
	{
		connectionURI = "amqp://" + username + ":" + passwd + "@" + hostname + ":" + port;
	}

	//create request object to be executed
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
	
	//call monitor
	monitorRabbitAvailability(requests);
	
}



// ################# RABBITMQ AVAILABILITY CHECK ###########################
/*
* Retrieve metrics information
* Receive: object request containing configuration
*/
function monitorRabbitAvailability(requests) 
{
	var amqp = require('amqp');
	
	for(var i in requests)
	{
		var done = false;
		var timeoutFunc;
		var request = requests[i];
		
		var start = Date.now();
		
		//set connection options
		var options = { host: request.hostname
			, port: request.port
			, login: request.username
			, password: request.passwd
		}
		
		//create connection
		var conn = amqp.createConnection(options, {reconnect: false});
		
		var metrics = [];
		
		//on connect event
		conn.on('connect', function(){
		
			//force connection timeout after 50s without answer 
			timeoutFunc = setTimeout(function () {
				
				conn.socket.destroy();
				
				var metric = new Object();
				metric.id = statusId;
				metric.val = '0';
				metric.ts = start;
				metric.exec = Date.now() - start;
				
				metrics.push(metric);
			
				output(metrics);
				
			}, 50000)
		})
		
		//on ready event (successful connection)
		conn.on('ready', function () {
			
			clearTimeout(timeoutFunc);
			
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
			
			done = true;
			
			connection.disconnect();
			
		});
		
		
		
		//on error event 
		conn.on('error', function (err) {
			
			if(!done)
			{
				if(err.code === 'ECONNRESET')
				{
					errorHandler(new ConnectionOrAuthenticationError());
				}
				
				
				if (request.checkStatus) 
				{
					var metric = new Object();
					metric.id = statusId;
					metric.val = '0';
					metric.ts = start;
					metric.exec = Date.now() - start;
					
					metrics.push(metric);
				}
				
				output(metrics);
			}
		});
	}
}


//################### OUTPUT METRICS ###########################
/*
* Send metrics to console
* Receive: metrics list to output
*/
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
}


//################### ERROR HANDLER #########################
/*
* Used to handle errors of async functions
* Receive: Error/Exception
*/
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


//####################### EXCEPTIONS ################################

//All exceptions used in script

function InvalidParametersNumberError() {
    this.name = "InvalidParametersNumberError";
    this.message = "Wrong number of parameters.";
	this.code = 3;
}
InvalidParametersNumberError.prototype = Object.create(Error.prototype);
InvalidParametersNumberError.prototype.constructor = InvalidParametersNumberError;

function ConnectionOrAuthenticationError() {
    this.name = "ConnectionOrAuthenticationError";
    this.message = "Connection closed unexpectedly or invalid authentication.";
	this.code = 24;
}
ConnectionOrAuthenticationError.prototype = Object.create(Error.prototype);
ConnectionOrAuthenticationError.prototype.constructor = ConnectionOrAuthenticationError;
