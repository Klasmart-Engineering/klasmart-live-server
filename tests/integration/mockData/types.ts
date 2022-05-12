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


export enum ContentType {
  Blank = "Blank",
  Stream = "Stream",
  Activity = "Activity",
  Video = "Video",
  Audio = "Audio",
  Image = "Image",
  Camera = "Camera",
  Screen = "Screen",
}