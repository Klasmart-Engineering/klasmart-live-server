export type WhiteboardPermissions = {
  allowShowHide: boolean;
  allowCreateShapes: boolean;
  allowEditShapes: {
      own: boolean;
      others: boolean;
  };
  allowDeleteShapes: {
      own: boolean;
      others: boolean;
  };
}