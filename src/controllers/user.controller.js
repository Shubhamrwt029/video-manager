import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { cookieOptions } from "../constants/index.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = await user.generateAccessToken();
    const refreshToken = await user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating access and refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { fullName, username, email, password } = req.body;

  if (
    [fullName, username, email, password]?.some((item) => item?.trim === "")
  ) {
    throw new ApiError(400, "All fields are required");
  }

  const isUserExist = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (isUserExist) throw new ApiError(409, "User or Email already exists");

  const avatarLocalPath = req.files?.avatar?.[0]?.path;
  const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

  if (!avatarLocalPath) throw new ApiError("400", "Avatar is required");

  const avatarPath = await uploadOnCloudinary(avatarLocalPath);
  const coverPath = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatarPath) throw new ApiError("400", "Avatar is required");

  const user = await User.create({
    email,
    username,
    fullName,
    password,
    avatar: avatarPath?.url,
    coverImage: coverPath?.url || "",
  });

  const createdUser = await User.findById(user?._id).select(
    "-password -refreshToken"
  );

  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering the user");

  return res
    .status(201)
    .json(new ApiResponse(201, createdUser, "User registered successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  if (!(username || email)) {
    throw new ApiError(400, "Username or Email is required");
  }
  const user = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  const fetchedUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  return res
    .status(200)
    .cookie("accessToken", accessToken, cookieOptions)
    .cookie("refreshToken", refreshToken, cookieOptions)
    .json(
      new ApiResponse(
        200,
        {
          user: fetchedUser,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: { refreshToken: null },
    },
    { new: true }
  );

  return res
    .status(200)
    .clearCookie("AccessToken", cookieOptions)
    .clearCookie("refreshToken", cookieOptions)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const refreshAccessToken = async (req, res) => {
  const clientRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;
  if (!clientRefreshToken) throw new ApiError(401, "Unauthorized request");

  {
    try {
      const decodedToken = jwt.verify(
        clientRefreshToken,
        process.env.REFRESH_TOKEN_SECRET
      );

      const user = await User.findById(decodedToken?._id);

      if (!user) throw new ApiError(401, "Invalid refresh token");

      if (clientRefreshToken !== user?.refreshToken)
        throw new ApiError(401, "Refresh token is expired");

      const { accessToken, refreshToken } = generateAccessAndRefreshToken(
        user?._id
      );

      return res
        .status(200)
        .cookie("access_token", accessToken)
        .cookie("refresh_token", refreshToken)
        .json(
          new ApiResponse(
            200,
            { accessToken, refreshToken },
            "Access token refreshed"
          )
        );
    } catch (error) {
      throw new ApiError(401, error.message || "Invalid refresh token");
    }
  }
};

export { registerUser, loginUser, logoutUser, refreshAccessToken };
