import {randomUUID} from "node:crypto";
import type {ComponentProps} from "react";
import {OperationDialog} from "./operation-dialog";

// Each server action response renders a new operation instance. The notice remains
// on the underlying page, including validation errors. Never change form actions.
export function Operation(props:ComponentProps<typeof OperationDialog>){
 return <OperationDialog key={randomUUID()} {...props}/>;
}
