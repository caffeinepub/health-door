import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";
import Array "mo:core/Array";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
  // Initialize the access control system
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

  let userScans = Map.empty<Principal, [ScanRecord]>();
  let userProfiles = Map.empty<Principal, UserProfile>();

  // User profile management functions
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can access profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Scan management functions
  public shared ({ caller }) func saveScan(medicineName : Text, manufacturingDate : Text, expiryDate : Text, imageUrl : Text) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can save scans");
    };

    let newScan : ScanRecord = {
      medicine_name = medicineName;
      manufacturing_date = manufacturingDate;
      expiry_date = expiryDate;
      timestamp = Time.now();
      imageUrl;
    };

    let existingScans = userScans.get(caller);

    let updatedScans = switch (existingScans) {
      case (null) {
        [newScan];
      };
      case (?scans) {
        let currentSize = scans.size();

        if (currentSize >= MAX_SCANS) {
          Array.tabulate(
            MAX_SCANS,
            func(i) {
              if (i == 0) { newScan } else {
                scans[i - 1];
              };
            },
          );
        } else {
          let newArray = Array.tabulate(
            currentSize + 1,
            func(i) { if (i == 0) { newScan } else { scans[i - 1] } },
          );
          newArray;
        };
      };
    };
    userScans.add(caller, updatedScans);
  };

  public query ({ caller }) func getScans() : async [ScanRecord] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can fetch scans");
    };

    switch (userScans.get(caller)) {
      case (null) { [] };
      case (?scans) { scans };
    };
  };
};
