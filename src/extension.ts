import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "p5-server" is now active!');

	let disposable = vscode.commands.registerCommand('p5-server.start', () => {
		vscode.window.showInformationMessage('p5-server is running!');
	});
	context.subscriptions.push(disposable);
	disposable = vscode.commands.registerCommand('p5-server.stop', () => {
		vscode.window.showInformationMessage('p5-server is stopped!');
	});
	context.subscriptions.push(disposable);
}

export function deactivate() { }
