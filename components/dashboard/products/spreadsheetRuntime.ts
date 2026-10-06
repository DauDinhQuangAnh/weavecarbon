// Keep a narrow asynchronous entry: importing the whole package dynamically
// would also retain spreadsheet writers that product imports never use.
export { read, utils } from "@e965/xlsx";
