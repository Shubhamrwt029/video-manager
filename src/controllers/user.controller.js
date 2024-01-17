import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const registerUser = asyncHandler(async (req, res) => {
  //   return res.status(200).json({
  //     message: "Ok",
  //   });
  const { fullname, username, email, password } = req.body;
  console.log("email: ", email);

  if ([fullname, username, email, password]?.some((item) => item.trim === "")) {
    throw new ApiError(400, "All fields are required");
  }

  const isUserExist = User.findOne({
    $or: [{ username }, { email }],
  });

  if (isUserExist) throw new ApiError(409, "User or Email already exists");

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) throw new ApiError("400", "Avatar is required");

  const avatarPath = await uploadOnCloudinary(avatarLocalPath);
  const coverPath = await uploadOnCloudinary(avatarLocalPath);

  if (!avatarPath) throw new ApiError("400", "Avatar is required");

  const user = User.create({
    email,
    username,
    fullname,
    password,
    avatar: avatarPath?.url,
    coverPath: coverPath?.url || "",
  });

  const createdUser = User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering the user");

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

export { registerUser };
