import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Array "mo:core/Array";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";
import Outcall "http-outcalls/outcall";

actor {
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  type ScanRecord = {
    medicine_name : Text;
    manufacturing_date : Text;
    expiry_date : Text;
    timestamp : Int;
    imageUrl : Text;
  };

  public type UserProfile = {
    name : Text;
  };

  let MAX_SCANS = 10;
  let GEMINI_API_KEY = "AIzaSyC19ggzJe-OwMn02MJ4yA6X5QtTYTakSfI";

  let userScans = Map.empty<Principal, [ScanRecord]>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  func requireAuthenticated(caller : Principal) {
    if (caller.isAnonymous()) {
      Runtime.trap("Unauthorized: Please sign in to use this feature");
    };
  };

  public query func transform(input : Outcall.TransformationInput) : async Outcall.TransformationOutput {
    Outcall.transform(input);
  };

  public shared func analyzeImage(base64Data : Text, mimeType : Text) : async Text {
    // No embedded double-quotes in prompt to avoid breaking JSON request body
    let prompt = "You are an OCR system for medicine strips. Analyze this image and extract the medicine name, manufacturing date (MFG or MFD label), and expiry date (EXP or USE BEFORE label). Respond with ONLY a valid JSON object with exactly these keys: medicine_name, manufacturing_date, expiry_date. If a field cannot be clearly read set its value to: Not detected. Never guess or fabricate. If image quality is too poor respond with a JSON object with one key named error and value: Image quality is too poor, please upload a clearer photo. Do not include markdown, code fences, or any text outside the JSON object.";

    let requestBody = "{\"contents\":[{\"parts\":[{\"text\":\"" # prompt # "\"},{\"inline_data\":{\"mime_type\":\"" # mimeType # "\",\"data\":\"" # base64Data # "\"}}]}]}";

    let url = "https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=" # GEMINI_API_KEY;

    await Outcall.httpPostRequest(
      url,
      [{ name = "Content-Type"; value = "application/json" }],
      requestBody,
      transform,
    );
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    requireAuthenticated(caller);
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    requireAuthenticated(caller);
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func saveScan(medicineName : Text, manufacturingDate : Text, expiryDate : Text, imageUrl : Text) : async () {
    requireAuthenticated(caller);

    let newScan : ScanRecord = {
      medicine_name = medicineName;
      manufacturing_date = manufacturingDate;
      expiry_date = expiryDate;
      timestamp = Time.now();
      imageUrl;
    };

    let existingScans = userScans.get(caller);

    let updatedScans = switch (existingScans) {
      case (null) { [newScan] };
      case (?scans) {
        let currentSize = scans.size();
        if (currentSize >= MAX_SCANS) {
          Array.tabulate(MAX_SCANS, func(i) { if (i == 0) { newScan } else { scans[i - 1] } });
        } else {
          Array.tabulate(currentSize + 1, func(i) { if (i == 0) { newScan } else { scans[i - 1] } });
        };
      };
    };
    userScans.add(caller, updatedScans);
  };

  public query ({ caller }) func getScans() : async [ScanRecord] {
    requireAuthenticated(caller);
    switch (userScans.get(caller)) {
      case (null) { [] };
      case (?scans) { scans };
    };
  };
};
