setwd("C:/Users/ivanv/Desktop/UMN_GIT/Genotyping_Data/DArtTag_vs_Agriplex/") 

# 1) Get Geno tables DSO and AGP 

# 2) Common Samples (Rename based on Pedigree) 

# 4) Write VCF (full marker set for each and same sample names 

# 5) Filter sites/taxa and impute both 

# 6) get DF for both  

# #### 
# 7) tanglegram with only common markers and taxa

# 8) tanglegram with complete marker set for the same set of taxa  

#### 

# 9) dapcs/pca and scatter/sclass plots 

# 10) STRUCTURE analysis



DSO_Alleles <- read.csv("DArTag_Matches_Data.csv")


DSO_Alleles_Tab0 <- as.data.frame(t(DSO_Alleles[,-c(1:5)]))
colnames(DSO_Alleles_Tab0) <- DSO_Alleles[,3]
DSO_Alleles_Tab <- rbind.data.frame(DSO_Alleles[,5],DSO_Alleles_Tab0)

#DSO_Alleles_Tab<- DSO_Alleles_Tab
dim(DSO_Alleles_Tab)
#[1] 2842  317

DSO_Alleles_Tab$CHROM <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[1]))
DSO_Alleles_Tab$POS <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[2]))
DSO_Alleles_Tab$REF <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[3]))
DSO_Alleles_Tab$ALT <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[4]))
DSO_Alleles_Tab$ChrPosV1 <- paste(DSO_Alleles_Tab$CHROM,DSO_Alleles_Tab$POS,sep="-")

sampleIDInd <- grep("^24",colnames(DSO_Alleles_Tab))
sampleID <- colnames(DSO_Alleles_Tab)[sampleIDInd] 

DSO_Alleles_Tab_Mod <-DSO_Alleles_Tab
DSO_Alleles_Tab_Mod[2:nrow(DSO_Alleles_Tab_Mod),sampleIDInd] <- apply(DSO_Alleles_Tab_Mod[2:nrow(DSO_Alleles_Tab_Mod),sampleIDInd],2,function(x) gsub(":","/",x))
DSO_Alleles_Tab_Mod$POS <- as.numeric(DSO_Alleles_Tab_Mod$POS)
DSO_Alleles_Tab_Mod <- DSO_Alleles_Tab_Mod[order(DSO_Alleles_Tab_Mod$CHROM,DSO_Alleles_Tab_Mod$POS),]
DSO_Alleles_Tab_Mod$MarkerID <- rownames(DSO_Alleles_Tab_Mod)
DSO_Alleles_Tab_Mod[1:5,1:10]

DSO_Alleles_TabX <- DSO_Alleles_Tab_Mod[,c("MarkerID","ChrPosV1","CHROM","POS","REF","ALT",sampleID)]

### 



DSO_Alleles <- read.csv("DArTagCorrectData_317samples.csv")


DSO_Alleles_Tab0 <- as.data.frame(t(DSO_Alleles[,-c(1:3)]))
colnames(DSO_Alleles_Tab0) <- DSO_Alleles[,1]
DSO_Alleles_Tab <- rbind.data.frame(DSO_Alleles[,3],DSO_Alleles_Tab0)

#DSO_Alleles_Tab<- DSO_Alleles_Tab
dim(DSO_Alleles_Tab)
#[1] 2842  317

DSO_Alleles_Tab$CHROM <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[1]))
DSO_Alleles_Tab$POS <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[2]))
DSO_Alleles_Tab$REF <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[3]))
DSO_Alleles_Tab$ALT <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab),"_"),function(x) x[4]))
DSO_Alleles_Tab$ChrPosV1 <- paste(DSO_Alleles_Tab$CHROM,DSO_Alleles_Tab$POS,sep="-")

sampleIDInd <- grep("^24",colnames(DSO_Alleles_Tab))
sampleID <- colnames(DSO_Alleles_Tab)[sampleIDInd] 

DSO_Alleles_Tab_Mod <-DSO_Alleles_Tab
DSO_Alleles_Tab_Mod[2:nrow(DSO_Alleles_Tab_Mod),sampleIDInd] <- apply(DSO_Alleles_Tab_Mod[2:nrow(DSO_Alleles_Tab_Mod),sampleIDInd],2,function(x) gsub(":","/",x))
DSO_Alleles_Tab_Mod$POS <- as.numeric(DSO_Alleles_Tab_Mod$POS)
DSO_Alleles_Tab_Mod <- DSO_Alleles_Tab_Mod[order(DSO_Alleles_Tab_Mod$CHROM,DSO_Alleles_Tab_Mod$POS),]
DSO_Alleles_Tab_Mod$MarkerID <- rownames(DSO_Alleles_Tab_Mod)
DSO_Alleles_Tab_Mod[1:5,1:10]

DSO_Alleles_TabX <- DSO_Alleles_Tab_Mod[,c("MarkerID","ChrPosV1","CHROM","POS","REF","ALT",sampleID)]



###
DSO_Alleles_V1 <- read.csv("DArTag_Pedigree_Info.csv")

DSO_Alleles_Tab0_V1 <- as.data.frame(t(DSO_Alleles_V1[,-c(1:4)]))
colnames(DSO_Alleles_Tab0_V1) <- DSO_Alleles_V1[,3]
DSO_Alleles_Tab_V1 <- rbind.data.frame(DSO_Alleles_V1[,4],DSO_Alleles_Tab0_V1)

#DSO_Alleles_Tab_V1<- DSO_Alleles_Tab_V1
dim(DSO_Alleles_Tab_V1)
#[1] 2842  376

DSO_Alleles_Tab_V1$CHROM <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab_V1),"_"),function(x) x[1]))
DSO_Alleles_Tab_V1$POS <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab_V1),"_"),function(x) x[2]))
DSO_Alleles_Tab_V1$REF <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab_V1),"_"),function(x) x[3]))
DSO_Alleles_Tab_V1$ALT <- unlist(lapply(strsplit(rownames(DSO_Alleles_Tab_V1),"_"),function(x) x[4]))
DSO_Alleles_Tab_V1$ChrPosV1 <- paste(DSO_Alleles_Tab_V1$CHROM,DSO_Alleles_Tab_V1$POS,sep="-")

sampleIDInd <- grep("^24",colnames(DSO_Alleles_Tab_V1))
sampleID <- colnames(DSO_Alleles_Tab_V1)[sampleIDInd] 

DSO_Alleles_Tab_V1_Mod <-DSO_Alleles_Tab_V1
DSO_Alleles_Tab_V1_Mod[2:nrow(DSO_Alleles_Tab_V1_Mod),sampleIDInd] <- apply(DSO_Alleles_Tab_V1_Mod[2:nrow(DSO_Alleles_Tab_V1_Mod),sampleIDInd],2,function(x) gsub(":","/",x))
DSO_Alleles_Tab_V1_Mod$POS <- as.numeric(DSO_Alleles_Tab_V1_Mod$POS)
DSO_Alleles_Tab_V1_Mod <- DSO_Alleles_Tab_V1_Mod[order(DSO_Alleles_Tab_V1_Mod$CHROM,DSO_Alleles_Tab_V1_Mod$POS),]
DSO_Alleles_Tab_V1_Mod$MarkerID <- rownames(DSO_Alleles_Tab_V1_Mod)
DSO_Alleles_Tab_V1_Mod[1:5,1:10]

DSO_Alleles_Tab_V1X <- DSO_Alleles_Tab_V1_Mod[,c("MarkerID","ChrPosV1","CHROM","POS","REF","ALT",sampleID)]

####

idInd <- which(colnames(DSO_Alleles_TabX) %in% commonID[-c(1:6)])
idInd2 <- which(colnames(DSO_Alleles_Tab_V1X) %in% commonID[-c(1:6)])
setdiff(as.vector(unlist(DSO_Alleles_TabX[1,idInd])),as.vector(unlist(DSO_Alleles_Tab_V1X[1,idInd2])))

# id1 <- as.vector(colnames(DSO_Alleles_TabX)[idInd])
# id2 <- as.vector(colnames(DSO_Alleles_Tab_V1X)[idInd2])



id1 <- as.vector(colnames(DSO_Alleles_TabX))
id2 <- as.vector(colnames(DSO_Alleles_Tab_V1X))
common <- intersect(id1,id2)
ix1 <- match(common, id1)
ix2 <- match(common, id2)
all(id1[ix1] == id2[ix2]) 

#### 


#### For Concordance % use filt2 

Tab1 <- DSO_Alleles_TabX[,ix1]
Tab2 <- DSO_Alleles_Tab_V1X[,ix2]
# STEP 1: Subset to just genotype columns (skip metadata)
geno_cols <- 7:ncol(Tab1)  # Adjust if needed; assumes REF, ALT end at col 5

Geno1 <- (Tab1[-1, geno_cols])
Geno2 <- (Tab2[-1, geno_cols])

all(colnames(Geno1) == colnames(Geno2)) 
all(rownames(Geno1) == rownames(Geno2)) 



Geno1 <- (Tab1[2:6, 7:12])
Geno2 <- (Tab2[2:6, 7:12])

all(colnames(Geno1) == colnames(Geno2)) 
all(rownames(Geno1) == rownames(Geno2)) 

count <- rep(0,nrow(Geno1))
totcount <- rep(0,nrow(Geno1))
for(i in 1:nrow(Geno1)){ 

      count[i] <-   length(which(Geno1[i,]==Geno2[i,]))
	  totcount[i] <- length(Geno1[i,])
}

sum(count)/sum(totcount)

####


# 
# # Ensure same order of markers and samples
# Geno1 <- Geno1[rown, ]
# Geno2 <- Geno2[rownames(Tab1), Geno1[1,]]

# STEP 2: Compare genotypes where BOTH are not "./."
is_non_missing <- (Geno1 != "-/-") & (Geno2 != "-/-")
is_match <- Geno1 == Geno2

# STEP 3: Only count where both are non-missing
comparison_matrix <- ifelse(is_non_missing, is_match, NA)


# STEP 4: Summary
match_count <- sum(comparison_matrix, na.rm = TRUE)
total_non_missing_compared <- sum(!is.na(comparison_matrix))
percent_match <- 100 * match_count / total_non_missing_compared


# Output summary
cat("Genotype Match Rate (non-missing sites only):", percent_match, "%\n")

# cat("Genotype Match Rate:", percent_match, "%\n")
Genotype Match Rate: 85.40499 %

match_count <- sum(is_non_missing & is_match, na.rm = TRUE)
nonmatch_count <- sum(is_non_missing & !is_match, na.rm = TRUE)
total_compared <- match_count + nonmatch_count
match_rate <- 100 * match_count / total_compared



# STEP 6: Print summary
cat("Total compared (non-missing):", total_compared, "\n")
cat("Matches:", match_count, "\n")
cat("Non-matches:", nonmatch_count, "\n")
cat(sprintf("Match rate: %.2f%%\n", match_rate)) 

###


#### Translate allelic code to numeric code
InfoCols_Dos <- colnames(DSO_Alleles_TabX)[1:6]
samples_Dos <- setdiff(colnames(DSO_Alleles_TabX),InfoCols_Dos)
sampleColIndx2_Dos <- which(colnames(DSO_Alleles_TabX) %in% samples_Dos)
RefIndx_Dos <- which(colnames(DSO_Alleles_TabX) %in% "REF")
AltIndx_Dos <- which(colnames(DSO_Alleles_TabX) %in% "ALT")

# Define a function to translate genotype codes
translate_genotype_vcf_num_DSO <- function(genotype,sampleColIndx2,RefIndx,AltIndx){
  genotypeMod <- genotype
  genotypeMod[sampleColIndx2] <- gsub("-/-","\\./\\.",genotypeMod[sampleColIndx2])
  
  ## REF
  genotypeMod[sampleColIndx2] <- gsub(as.character(genotypeMod[RefIndx]),"0",genotypeMod[sampleColIndx2])
  
  ## ALT 
  if(length(grep(",",genotypeMod[AltIndx]))>0){
    AltState <- unlist(strsplit(as.character(genotypeMod[AltIndx]),",")[[1]])
  }else{AltState <- genotypeMod[AltIndx]} 
  
  AltState <- gsub(" ","",AltState)
  
  for(nAlt in 1:length(AltState)){
    #genotypeMod[sampleColIndx2] <- gsub(genotypeMod[AltIndx],"1",genotypeMod[sampleColIndx2])
    genotypeMod[sampleColIndx2] <- gsub(AltState[nAlt],as.character(nAlt),genotypeMod[sampleColIndx2])
  }
  
  genotypeMod[sampleColIndx2]<- gsub(" ","",genotypeMod[sampleColIndx2])
  genotypeMod
}


# translate_genotype_vcf_num(DSO_Pop_Geno_Filt_VCF_Mod[1,],sampleColIndx2,RefIndx,AltIndx)
DSO_Alleles_TabX_Num <- DSO_Alleles_TabX
for(x in 2:nrow(DSO_Alleles_TabX)){ 
  DSO_Alleles_TabX_Num[x,] <- translate_genotype_vcf_num_DSO(DSO_Alleles_TabX[x,],sampleColIndx2_Dos,RefIndx_Dos,AltIndx_Dos)
}

######## 

AGP_Alleles <- read.csv("AGriPlexDataCorrected_317samples.csv")

AGP_Alleles_T <- t(AGP_Alleles)
AGP_Alleles_Tab0 <- AGP_Alleles_T[-c(1:3),]
colnames(AGP_Alleles_Tab0) <- AGP_Alleles_T[2,]
AGP_Alleles_Tab1 <- cbind.data.frame(rownames(AGP_Alleles_Tab0),AGP_Alleles_Tab0)
colnames(AGP_Alleles_Tab1)[1] <- "MarkerID"

AGP_Alleles_Tab <- rbind.data.frame(c("Ped",AGP_Alleles_T[3,]),AGP_Alleles_Tab1)
`

AGP_Alleles_Tab$CHROM <- unlist(lapply(strsplit(AGP_Alleles_Tab[,"MarkerID"],"_"),function(x) x[4]))
AGP_Alleles_Tab$POS <- unlist(lapply(strsplit(AGP_Alleles_Tab[,"MarkerID"],"_"),function(x) x[5]))
AGP_Alleles_Tab$REF <- unlist(lapply(strsplit(rownames(AGP_Alleles_Tab),"_"),function(x) x[6]))
AGP_Alleles_Tab$ALT <- unlist(lapply(strsplit(rownames(AGP_Alleles_Tab),"_"),function(x) x[7]))
AGP_Alleles_Tab$ChrPosV1 <- paste(AGP_Alleles_Tab$CHROM,AGP_Alleles_Tab$POS,sep="-")

AGP_Alleles_Tab[1:5,1:10]
sampleIDInd <- grep("^24",colnames(AGP_Alleles_Tab))
sampleID <- colnames(AGP_Alleles_Tab)[sampleIDInd]

BARC_markerIDs <- grep("BARC",AGP_Alleles_Tab[,"MarkerID"],value=TRUE)
BARC_markerIDsInd <- grep("BARC",AGP_Alleles_Tab[,"MarkerID"]) 
trt_markerIDs <- AGP_Alleles_Tab[,"MarkerID"][c((BARC_markerIDsInd[length(BARC_markerIDsInd)]+1):length(AGP_Alleles_Tab[,"MarkerID"]))]
trt_markerIDsInd <- c((BARC_markerIDsInd[length(BARC_markerIDsInd)]+1):length(AGP_Alleles_Tab[,"MarkerID"])) 


AGP_Alleles_TabX <- AGP_Alleles_Tab[c(1,BARC_markerIDsInd),c("MarkerID","ChrPosV1","CHROM","POS","REF","ALT",sampleID)]
AGP_Alleles_TabX$MarkerID <- gsub("BARC_1_01_","",AGP_Alleles_TabX$MarkerID)


tabXMarkersID <- intersect(AGP_Alleles_TabX[-1,"MarkerID"],DSO_Alleles_TabX[-1,"MarkerID"])
length(tabXMarkersID)

### 

AGP_Alleles_TabX_CM <- AGP_Alleles_TabX[which(AGP_Alleles_TabX$MarkerID %in% tabXMarkersID),]
DSO_Alleles_TabX_CM <- DSO_Alleles_TabX[which(DSO_Alleles_TabX$MarkerID %in% tabXMarkersID),]



#### Translate allelic code to numeric code
InfoCols <- colnames(AGP_Alleles_TabX)[1:6]
samples <- setdiff(colnames(AGP_Alleles_TabX),InfoCols)
sampleColIndx2_AGP <- which(colnames(AGP_Alleles_TabX) %in% samples)
RefIndx <- which(colnames(AGP_Alleles_TabX) %in% "REF")
AltIndx <- which(colnames(AGP_Alleles_TabX) %in% "ALT")

# Define a function to translate genotype codes
translate_genotype_vcf_num <- function(genotype,sampleColIndx2,RefIndx,AltIndx){
  genotypeMod <- genotype
  HomIndx <- grep("/",genotypeMod[sampleColIndx2],invert=TRUE)
  HetIndx <- grep("/",genotypeMod[sampleColIndx2],invert=FALSE)
  
  ## FAIL
  genotypeMod[sampleColIndx2] <- gsub("FAIL","\\./\\.",genotypeMod[sampleColIndx2])
  
  ## REF
  genotypeMod[sampleColIndx2] <- gsub(as.character(genotypeMod[RefIndx]),"0",genotypeMod[sampleColIndx2])
  genotypeMod[sampleColIndx2][HomIndx] <- gsub("0","0/0",genotypeMod[sampleColIndx2][HomIndx])
  
  
  ## ALT 
  if(length(grep(",",genotypeMod[AltIndx]))>0){
    AltState <- unlist(strsplit(as.character(genotypeMod[AltIndx]),",")[[1]])
  }else{AltState <- genotypeMod[AltIndx]} 
  
  AltState <- gsub(" ","",AltState)
  
  for(nAlt in 1:length(AltState)){
    #genotypeMod[sampleColIndx2] <- gsub(genotypeMod[AltIndx],"1",genotypeMod[sampleColIndx2])
    genotypeMod[sampleColIndx2] <- gsub(AltState[nAlt],as.character(nAlt),genotypeMod[sampleColIndx2])
  }
  for(nAlt in 1:length(AltState)){
    genotypeMod[sampleColIndx2][HomIndx] <- gsub(as.character(nAlt),paste(as.character(nAlt),"/",as.character(nAlt),sep=""),genotypeMod[sampleColIndx2][HomIndx])
  }
  
  genotypeMod[sampleColIndx2][HetIndx] <- gsub(" ","",genotypeMod[sampleColIndx2][HetIndx])
  genotypeMod
}

# translate_genotype_vcf_num(AGP_Pop_Geno_Filt_VCF_Mod[1,],sampleColIndx2,RefIndx,AltIndx)
AGP_Alleles_TabX_Num <- AGP_Alleles_TabX
for(x in 2:nrow(AGP_Alleles_TabX)){ 
  AGP_Alleles_TabX_Num[x,] <- translate_genotype_vcf_num(AGP_Alleles_TabX[x,],sampleColIndx2_AGP,RefIndx,AltIndx)
}

dim(AGP_Alleles_TabX)
# [1] 1243  321
AGP_Alleles_TabX_Num$MarkerID <- gsub("BARC_1_01_","",AGP_Alleles_TabX_Num$MarkerID)


### Comparisons AGP vs DSO
length(which(AGP_Alleles_TabX_Num$MarkerID %in% DSO_Alleles_TabX_Num$MarkerID)) 

commonMarkerIDs <- AGP_Alleles_TabX_Num$MarkerID[which(AGP_Alleles_TabX_Num$MarkerID %in% DSO_Alleles_TabX_Num$MarkerID)]
length(commonMarkerIDs)
#[1] 1068


### Compare tables on Pedigree information 


Ped_DSO <- DSO_Alleles_TabX_Num[1,sampleColIndx2_Dos]
Ped_AGP <- AGP_Alleles_TabX_Num[1,sampleColIndx2_AGP]


Ped_DSO_clean <- lapply(Ped_DSO, function(x) iconv(x, from = "latin1", to = "UTF-8"))

length(which(Ped_AGP %in% Ped_DSO))
#[1] 317
length(which(Ped_AGP %in% Ped_DSO_clean))
#[1] 263

### Order columns and rows in both tables based on matching pedigrees 

# Indices of AGP entries in cleaned DSO
match_idx <- match(Ped_AGP, Ped_DSO)

# Filter only matched entries
valid <- !is.na(match_idx)

Ped_AGP_matched <- Ped_AGP[valid]
Ped_DSO_matched <- Ped_DSO_clean[match_idx[valid]]

#### 

match_idx <- match(Ped_AGP, Ped_DSO)
valid_idx <- which(!is.na(match_idx))  # Only keep matched entries

## Create Aligned Tables 
# Reorder AGP columns to matched entries
AGP_Aligned <- AGP_Alleles_TabX_Num[, c(1:6,sampleColIndx2_AGP[valid_idx])]

# Reorder DSO columns to the same order as AGP
DSO_Aligned <- DSO_Alleles_TabX_Num[, c(1:6,sampleColIndx2_Dos[match_idx[valid_idx]])]


DSO_Aligned[1,1:6] <- "Ped"
AGP_Aligned[1,1:6] <- "Ped"

# Check that the names are aligned
all(DSO_Aligned[1, ] == AGP_Aligned[1, ])  # Should return TRUE
#[1] TRUE


### Common markers 
DSO_Aligned_Filt <- DSO_Aligned[c(1,which(DSO_Aligned$MarkerID %in% commonMarkerIDs)),]

AGP_Aligned_Filt <- AGP_Aligned[c(1,which(AGP_Aligned$MarkerID %in% commonMarkerIDs)),]


# Check that the names are aligned
all(DSO_Aligned_Filt[-1,"MarkerID" ] == AGP_Aligned_Filt[-1,"MarkerID" ])  # Should return TRUE
# [1] TRUE

dim(DSO_Aligned_Filt)
#[1] 1069  323

dim(AGP_Aligned_Filt)
#[1] 1069  323



### All markers 
 
DSO_Aligned_Filt <- DSO_Aligned
AGP_Aligned_Filt <- AGP_Aligned

colnames(DSO_Aligned_Filt) <- colnames(AGP_Aligned_Filt) 
all(colnames(DSO_Aligned_Filt) == colnames(AGP_Aligned_Filt)) 
#[1] TRUE


### Remove Pedigree info from Row 1


DSO_Aligned_Filt_DF <- DSO_Aligned_Filt[-1,-c(1:2)]
AGP_Aligned_Filt_DF <- AGP_Aligned_Filt[-1,-c(1:2)]

dim(DSO_Aligned_Filt_DF)
#[1] 2841  321
dim(AGP_Aligned_Filt_DF)
#[1] 1242  321

###

DSO_Aligned_Filt_DF$ID <- rownames(DSO_Aligned_Filt_DF) 
DSO_Aligned_Filt_DF$QUAL <- rep(".",nrow(DSO_Aligned_Filt_DF))
DSO_Aligned_Filt_DF$FILTER <- rep("PASS",nrow(DSO_Aligned_Filt_DF))
DSO_Aligned_Filt_DF$INFO <- rep(".",nrow(DSO_Aligned_Filt_DF))
DSO_Aligned_Filt_DF$FORMAT <- rep("GT",nrow(DSO_Aligned_Filt_DF))

###
INFOCols <- c("CHROM","POS","ID","REF","ALT","QUAL","FILTER","INFO","FORMAT")
sampleCols <- grep("^24",colnames(DSO_Aligned_Filt_DF),value=T)
DSO_Aligned_Filt_DF_Ord <- DSO_Aligned_Filt_DF[,c(INFOCols,sampleCols)]

dim(DSO_Aligned_Filt_DF_Ord )
#[1] 2841  326
#### 

AGP_Aligned_Filt_DF$ID <- rownames(AGP_Aligned_Filt_DF) 
AGP_Aligned_Filt_DF$QUAL <- rep(".",nrow(AGP_Aligned_Filt_DF))
AGP_Aligned_Filt_DF$FILTER <- rep("PASS",nrow(AGP_Aligned_Filt_DF))
AGP_Aligned_Filt_DF$INFO <- rep(".",nrow(AGP_Aligned_Filt_DF))
AGP_Aligned_Filt_DF$FORMAT <- rep("GT",nrow(AGP_Aligned_Filt_DF))

###
INFOCols <- c("CHROM","POS","ID","REF","ALT","QUAL","FILTER","INFO","FORMAT")
sampleCols <- grep("^24",colnames(AGP_Aligned_Filt_DF),value=T)
AGP_Aligned_Filt_DF_Ord <- AGP_Aligned_Filt_DF[,c(INFOCols,sampleCols)]
AGP_Aligned_Filt_DF_Ord$ID <- gsub("BARC_1_01_","",AGP_Aligned_Filt_DF_Ord$ID)

dim(AGP_Aligned_Filt_DF_Ord) 
# [1] 1242  326
#### 

#### Get VCF Header 

source("C:/Users/ivanv/Desktop/UMN_GIT/File_Conversion_Scripts/FileConversion_Source.R")

infileVCF <- "AGP_PYT_2024_Genotypes_a1_v1_checked.vcf"
AGP_Geno_Data_VCF <- readVCF_Data(infileVCF)
dim(AGP_Geno_Data_VCF$vcf_data)
#[1] 1242  981
AGP_Geno_Data_Out_Filt2 <- AGP_Geno_Data_VCF$vcf_data
AGP_Geno_Data_Out_Header <- AGP_Geno_Data_VCF$header



###
outFN <- paste("DSO_Aligned_Genotypes_a1_v1_Matched_V2.vcf",sep="")

#Write header to file
VCFHeader <- AGP_Geno_Data_Out_Header
writeLines(VCFHeader, outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(DSO_Aligned_Filt_DF_Ord), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(DSO_Aligned_Filt_DF_Ord,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)

####


# AGP_Aligned_Filt_DF_Ord

###
outFN <- paste("AGP_Aligned_Genotypes_a1_v1_Matched_V2.vcf",sep="")

#Write header to file
VCFHeader <- AGP_Geno_Data_Out_Header
writeLines(VCFHeader, outFN)

# Write column names to file
line1 <- paste("#", paste(colnames(AGP_Aligned_Filt_DF_Ord), collapse = '\t'), sep = "")
cat(line1, file = outFN, append = TRUE, "\n")
write.table(AGP_Aligned_Filt_DF_Ord,outFN,sep = "\t", col.names = FALSE, row.names = FALSE, quote=FALSE, append = TRUE)

########

bcftools +fixref AGP_Aligned_Genotypes_a1_v1_Matched.vcf  \
     -- -f ~/BD_Eliana_MasterTS/Gmax.a1.v1.fasta 
	 
# # SC, guessed strand convention
# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	53	4.3%
# ST	A>G	269	21.7%
# ST	A>T	0	0.0%
# ST	C>A	71	5.7%
# ST	C>G	0	0.0%
# ST	C>T	208	16.7%
# ST	G>A	229	18.4%
# ST	G>C	0	0.0%
# ST	G>T	50	4.0%
# ST	T>A	0	0.0%
# ST	T>C	286	23.0%
# ST	T>G	76	6.1%
# # NS, Number of sites:
# NS	total        	1242
# NS	ref match    	1242	100.0%
# NS	ref mismatch 	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0
 

bcftools +fixref DSO_Aligned_Genotypes_a1_v1_Matched.vcf  \
     -- -f ~/BD_Eliana_MasterTS/Gmax.a1.v1.fasta 



# # SC, guessed strand convention
# SC	TOP-compatible	0
# SC	BOT-compatible	0
# # ST, substitution types
# ST	A>C	172	6.1%
# ST	A>G	625	22.0%
# ST	A>T	0	0.0%
# ST	C>A	159	5.6%
# ST	C>G	0	0.0%
# ST	C>T	457	16.1%
# ST	G>A	483	17.0%
# ST	G>C	0	0.0%
# ST	G>T	145	5.1%
# ST	T>A	0	0.0%
# ST	T>C	641	22.6%
# ST	T>G	159	5.6%
# # NS, Number of sites:
# NS	total        	2841
# NS	ref match    	2841	100.0%
# NS	ref mismatch 	0	0.0%
# NS	skipped      	0
# NS	non-ACGT     	0
# NS	non-SNP      	0
# NS	non-biallelic	0




### rTASSEL Test

infileVCF_AGP <- "AGP_Aligned_Genotypes_a1_v1_Matched_V2.vcf"

## Read Tas geno table  
tasGeno_AGP <- rTASSEL::readGenotypeTableFromPath(path = infileVCF_AGP)

# A TasselGenotypePhenotype Dataset
  # Class.............. TasselGenotypePhenotype 
  # Taxa............... 317 
  # Positions.......... 1242 
  # Taxa x Positions... 393714 
# ---
  # Genotype Table..... [x]
  # Phenotype Table.... [ ]
### Filter 1 
siteMinCnt <- round(0.8*315,0)
MAF <- 0.02

tasGenoFilt1_AGP <- rTASSEL::filterGenotypeTableSites(tasObj = tasGeno_AGP,
                                                  siteMinCount = siteMinCnt,
                                                  siteMinAlleleFreq = MAF,
                                                  siteMaxAlleleFreq = 1.0,
                                                  siteRangeFilterType = "none"
)
tasGenoFilt1_AGP

# A TasselGenotypePhenotype Dataset
  # Class.............. TasselGenotypePhenotype 
  # Taxa............... 315 
  # Positions.......... 978 
  # Taxa x Positions... 308070 
# ---
  # Genotype Table..... [x]
  # Phenotype Table.... [ ]

### Filter 2
MinNotMissing <- 0.9

tasGenoFilt2_AGP <- rTASSEL::filterGenotypeTableTaxa(
  tasGenoFilt1_AGP,
  minNotMissing = MinNotMissing,
  minHeterozygous = 0,
  maxHeterozygous = 1,
  taxa = NULL
)

tasGenoFilt2_AGP

# A TasselGenotypePhenotype Dataset
  # Class.............. TasselGenotypePhenotype 
  # Taxa............... 316 
  # Positions.......... 1024 
  # Taxa x Positions... 323584 
# ---
  # Genotype Table..... [x]
  # Phenotype Table.... [ ]

### Imputation using LDKNNI 
FiltGeno_AGP <- tasGenoFilt2_AGP
l <- 30
k <- 10
impMethod <- "LDKNNI"

if(impMethod=="LDKNNI"){
  tasGenoImp_AGP <- rTASSEL::imputeLDKNNi(FiltGeno_AGP, highLDSSites = l, knnTaxa = k, maxDistance = 1e+07)
} 
# A TasselGenotypePhenotype Dataset
  #  Class.............. TasselGenotypePhenotype 
  # Taxa............... 316 
  # Positions.......... 1024 
  # Taxa x Positions... 323584 

#### Get GenoDF from TAS

 gt2d_AGP_Algnd_Geno <- as.data.frame(GS4PB:::getGenoTas_to_DF(tasGenoImp_AGP))
 gt2d_AGP_Algnd_Geno_DF <- gt2d_AGP_Algnd_Geno[order(gt2d_AGP_Algnd_Geno$Chrom,gt2d_AGP_Algnd_Geno$Position),]


# gt2d_AGP_Algnd_Geno <- as.data.frame(GS4PB:::getGenoTas_to_DF(FiltGeno_AGP))
# gt2d_AGP_Algnd_Geno_DF <- gt2d_AGP_Algnd_Geno[order(gt2d_AGP_Algnd_Geno$Chrom,gt2d_AGP_Algnd_Geno$Position),]


######


infileVCF_DSO <- "DSO_Aligned_Genotypes_a1_v1_Matched_V2.vcf"

## Read Tas geno table  
tasGeno_DSO <- rTASSEL::readGenotypeTableFromPath(path = infileVCF_DSO)

# A TasselGenotypePhenotype Dataset
  #  Class.............. TasselGenotypePhenotype 
  # Taxa............... 317 
  # Positions.......... 2841 
  # Taxa x Positions... 900597 
  # Genotype Table..... [x]
  # Phenotype Table.... [ ]

### Filter 1 
siteMinCnt <- round(0.8*315,0)
MAF <- 0.02

tasGenoFilt1_DSO <- rTASSEL::filterGenotypeTableSites(tasObj = tasGeno_DSO,
                                                  siteMinCount = siteMinCnt,
                                                  siteMinAlleleFreq = MAF,
                                                  siteMaxAlleleFreq = 1.0,
                                                  siteRangeFilterType = "none"
)
tasGenoFilt1_DSO

#A TasselGenotypePhenotype Dataset
# A TasselGenotypePhenotype Dataset
#  Class.............. TasselGenotypePhenotype 
# Taxa............... 317 
# Positions.......... 2153 
# Taxa x Positions... 682501 
# ---
#   Genotype Table..... [x]
# Phenotype Table.... [ ]


### Filter 2
MinNotMissing <- 0.9

tasGenoFilt2_DSO <- rTASSEL::filterGenotypeTableTaxa(
  tasGenoFilt1_DSO,
  minNotMissing = MinNotMissing,
  minHeterozygous = 0,
  maxHeterozygous = 1,
  taxa = NULL
)

tasGenoFilt2_DSO
#A TasselGenotypePhenotype Dataset
  # Class.............. TasselGenotypePhenotype 
  # Taxa............... 317 
  # Positions.......... 2153 
  # Taxa x Positions... 682501 
# ---
  # Genotype Table..... [x]
  # Phenotype Table.... [ ]
### Imputation using LDKNNI 
FiltGeno_DSO <- tasGenoFilt2_DSO
l <- 30
k <- 10
impMethod <- "LDKNNI"

if(impMethod=="LDKNNI"){
  tasGenoImp_DSO <- rTASSEL::imputeLDKNNi(FiltGeno_DSO, highLDSSites = l, knnTaxa = k, maxDistance = 1e+07)
} 
# A TasselGenotypePhenotype Dataset
# Class.............. TasselGenotypePhenotype 
# Taxa............... 317 
# Positions.......... 2153 
# Taxa x Positions... 682501 
# # ---
  # Genotype Table..... [x]
  # Phenotype Table.... [ ]

#### Get GenoDF from TAS

 gt2d_DSO_Algnd_Geno <- as.data.frame(GS4PB:::getGenoTas_to_DF(tasGenoImp_DSO))
 gt2d_DSO_Algnd_Geno_DF <- gt2d_DSO_Algnd_Geno[order(gt2d_DSO_Algnd_Geno$Chrom,gt2d_DSO_Algnd_Geno$Position),]


gt2d_DSO_Algnd_Geno <- as.data.frame(GS4PB:::getGenoTas_to_DF(FiltGeno_DSO))
gt2d_DSO_Algnd_Geno_DF <- gt2d_DSO_Algnd_Geno[order(gt2d_DSO_Algnd_Geno$Chrom,gt2d_DSO_Algnd_Geno$Position),]


##### Common Marker Set 


DSO_Algnd_DF_CM <- gt2d_DSO_Algnd_Geno_DF[which(gt2d_DSO_Algnd_Geno_DF[,"SNPID"] %in% commonMarkerIDs),]
AGP_Algnd_DF_CM <- gt2d_AGP_Algnd_Geno_DF[which(gt2d_AGP_Algnd_Geno_DF[,"SNPID"] %in% commonMarkerIDs),]

dim(DSO_Algnd_DF_CM)
#[1] 871 320

dim(AGP_Algnd_DF_CM)
#[1] 945 316

CM_Set <- intersect(AGP_Algnd_DF_CM$SNPID,DSO_Algnd_DF_CM$SNPID)
length(CM_Set)
#[1] 837

CMInd <- which(AGP_Algnd_DF_CM$SNPID %in% DSO_Algnd_DF_CM$SNPID)
length(CMInd)
#[1] 837


##
DSO_Algnd_DF_CM_Filt <- DSO_Algnd_DF_CM[which(DSO_Algnd_DF_CM[,"SNPID"] %in% CM_Set),-c(1:5)]
AGP_Algnd_DF_CM_Filt <- AGP_Algnd_DF_CM[which(AGP_Algnd_DF_CM[,"SNPID"] %in% CM_Set),-c(1:5)]

 
dim(DSO_Algnd_DF_CM_Filt)
#[1] 837 317

DSO_Algnd_DF_CM_Filt$Platform <- rep("DArtTag",nrow(DSO_Algnd_DF_CM_Filt))

AGP_Algnd_DF_CM_Filt$Platform <- rep("AgPlex",nrow(AGP_Algnd_DF_CM_Filt))

table( AGP_Algnd_DF_CM_Filt$Platform )
# AgPlex 
   # 837 
table( DSO_Algnd_DF_CM_Filt$Platform )
# DArtTag 
    # 837 

 dim(AGP_Algnd_DF_CM_Filt)
#[1] 837 316

#Geno_dendlist <- dendlist() 


DSO_Algnd_DF_CM_Filt <- DSO_Algnd_DF_CM[which(DSO_Algnd_DF_CM[,"SNPID"] %in% CM_Set),-c(1:5)]
AGP_Algnd_DF_CM_Filt <- AGP_Algnd_DF_CM[which(AGP_Algnd_DF_CM[,"SNPID"] %in% CM_Set),-c(1:5)]

rownames(DSO_Algnd_DF_CM_Filt) <- DSO_Algnd_DF_CM[which(DSO_Algnd_DF_CM[,"SNPID"] %in% CM_Set),"SNPID"]
rownames(AGP_Algnd_DF_CM_Filt) <- AGP_Algnd_DF_CM[which(AGP_Algnd_DF_CM[,"SNPID"] %in% CM_Set),"SNPID"]

all(rownames(DSO_Algnd_DF_CM_Filt)==rownames(AGP_Algnd_DF_CM_Filt))
# [1] TRUE

CM_Sample_Set <- intersect(colnames(DSO_Algnd_DF_CM_Filt),colnames(AGP_Algnd_DF_CM_Filt))
length(CM_Sample_Set)
#[1] 311


DSO_Algnd_DF_CM_Filt2 <- DSO_Algnd_DF_CM_Filt[,CM_Sample_Set] 
AGP_Algnd_DF_CM_Filt2 <- AGP_Algnd_DF_CM_Filt[,CM_Sample_Set]

all(rownames(DSO_Algnd_DF_CM_Filt2)==rownames(AGP_Algnd_DF_CM_Filt2))
#[1] TRUE
all(colnames(DSO_Algnd_DF_CM_Filt2)==colnames(AGP_Algnd_DF_CM_Filt2))
#[1] TRUE

################################################################################
#### For Concordance % use filt2 

Tab1 <- DSO_Algnd_DF_CM_Filt2
Tab2 <- AGP_Algnd_DF_CM_Filt2
# STEP 1: Subset to just genotype columns (skip metadata)
geno_cols <- 1:ncol(Tab1)  # Adjust if needed; assumes REF, ALT end at col 5

Geno1 <- (Tab1[, geno_cols])
Geno2 <- (Tab2[, geno_cols])



all(rownames(Geno1)==rownames(Geno2))
# [1] TRUE
all(colnames(Geno1)==colnames(Geno2))
# [1] TRUE

# # Ensure same order of markers and samples
# Geno1 <- Geno1[rown, ]
# Geno2 <- Geno2[rownames(Tab1), Geno1[1,]]

# STEP 2: Compare genotypes where BOTH are not "./."
#is_non_missing <- (Geno1 != NA) & (Geno2 != NA)

is_non_missing <- (!is.na(Geno1) & !is.na(Geno2))
is_match <- Geno1 == Geno2

# STEP 3: Only count where both are non-missing
comparison_matrix <- ifelse(is_non_missing, is_match, NA)

# STEP 4: Summary
match_count <- sum(comparison_matrix, na.rm = TRUE)
total_non_missing_compared <- sum(!is.na(comparison_matrix))
percent_match <- 100 * match_count / total_non_missing_compared


# Output summary
cat("Genotype Match Rate (non-missing sites only):", percent_match, "%\n")

## unimputed 
Genotype Match Rate (non-missing sites only): 83.22192 %
 

## imputed 
Genotype Match Rate (non-missing sites only): 83.22192 % 
 
#### Total compared & Match Rate 

match_count <- sum(is_non_missing & is_match, na.rm = TRUE)
nonmatch_count <- sum(is_non_missing & !is_match, na.rm = TRUE)
total_compared <- match_count + nonmatch_count
match_rate <- 100 * match_count / total_compared

# STEP 6: Print summary
cat("Total compared (non-missing):", total_compared, "\n")
cat("Matches:", match_count, "\n")
cat("Non-matches:", nonmatch_count, "\n")
cat(sprintf("Match rate: %.2f%%\n", match_rate)) 

##
cat("Total compared (non-missing):", total_compared, "\n")
#Total compared (non-missing): 266768 
cat("Matches:", match_count, "\n")
#Matches: 229416 
cat("Non-matches:", nonmatch_count, "\n")
#Non-matches: 37352 
cat(sprintf("Match rate: %.2f%%\n", match_rate))
#Match rate: 86.00%


#Step 7: Create a difference matrix cell-wise
diff_matrix <- matrix(NA, nrow = nrow(Geno1), ncol = ncol(Geno1))
rownames(diff_matrix) <- rownames(Geno1)
colnames(diff_matrix) <- colnames(Geno1)

# Step 7b: Fill only where values are non-missing and non-matching
diff_matrix[is_non_missing & !is_match] <- paste0(
        Geno1[is_non_missing & !is_match], " vs ", Geno2[is_non_missing & !is_match]
)

# Step 7c: Tabulate the nature of differences
diff_table <- table(na.omit(as.vector(diff_matrix)))
# 
# 0/0 vs 0/1 0/0 vs 1/1 0/1 vs 0/0 0/1 vs 1/1 1/1 vs 0/0 
# 4441      10516       5030       4847       8713 
# 1/1 vs 0/1 
# 3805 

cat("\nNature of non-matching differences:\n")
print(diff_table)

#####
Dso_Val_Tab <- table(apply(DSO_Alleles_TabX_Num[,sampleColIndx2_Dos],2,as.character))
# ./.        0/0        0/1        1/1 
# 0.09862706 0.49077995 0.04833105 0.36226194 

AgP_Val_Tab <- table(apply(AGP_Alleles_TabX_Num[,sampleColIndx2],2,as.character)) 

# ./.        0/0        0/1        1/1 
# 0.08435903 0.47958179 0.04290182 0.39315737 

geno_cols_DSO <- grep("^24",colnames(DSO_Aligned_Filt)) 

Dso_Val_Tab <- table(apply(DSO_Aligned_Filt[-1,geno_cols_DSO],2,as.character))

Dso_Val_Tab /sum(Dso_Val_Tab)
#  
#      ./.        0/0        0/1        1/1 
# 0.09976049 0.48980288 0.04564861 0.36478802 
geno_cols_AGP <- grep("^24",colnames(AGP_Aligned_Filt))

AGP_Aligned_Filt_V2 <- apply(AGP_Aligned_Filt[-1,geno_cols_AGP],2,function(x) gsub("0/0RUE","0/0",x))


AgP_Val_Tab <- table(apply(AGP_Aligned_Filt_V2,2,as.character)) 

AgP_Val_Tab/sum(AgP_Val_Tab)
#    
#     ./.        0/0        0/1        1/1 
# 0.08421849 0.47986610 0.04092311 0.39499230 

##


### PCA for comparison of platforms


rmGenoID <- setdiff(colnames(DSO_Algnd_DF_CM_Filt),colnames(AGP_Algnd_DF_CM_Filt))
#[1] "24GSDT00176"
rmGenoInd <- which(colnames(DSO_Algnd_DF_CM_Filt) %in% rmGenoID)

DSO_Algnd_DF_CM_Filt2 <- DSO_Algnd_DF_CM_Filt[,-rmGenoInd]

Combined_GenoData <- rbind.data.frame(DSO_Algnd_DF_CM_Filt2,AGP_Algnd_DF_CM_Filt)

dim(Combined_GenoData)
[1] 1674  317
#save(geno_imp_Mod_Comb,MGLev,file="NUST_Gcve_Geno_Imp_Mod_MG.RData")

pltfInd <- which(colnames(Combined_GenoData) == "Platform")
library(RSpectra)
ZZ <- as.matrix(Combined_GenoData[,-pltfInd])
pc = RSpectra::svds(ZZ,2)

# Libraries
library(ggplot2)
library(dplyr)
library(hrbrthemes)
library(viridis)


pltfVec <- Combined_GenoData$Platform

#

pc.DF <- as.data.frame(pc$u)
colnames(pc.DF) <- c("PC1","PC2")
pc.DF$Platform <- as.factor(pltfVec)
####



ggplot(pc.DF, aes(x = PC1, y = PC2, fill = Platform)) +
  geom_point(alpha = 0.7, size = 6, shape = 21, color = "black") +  # shape=21 allows fill and color
  scale_fill_manual(values = c("blue", "red")) +  
  theme_ipsum() +
  ylab("PC2") +
  xlab("PC1") +
  theme(
    legend.position = "bottom",
    axis.title.y = element_text(size = 16, face = "bold"),
    axis.title.x = element_text(size = 16, face = "bold"),
    legend.title = element_text(size = 20, face = "bold"),
    plot.background = element_rect(fill = "white")
  ) +
  guides(fill = guide_legend(override.aes = list(size = 5)))


### Prepare AlleleFormat for genind and adegenet pca methods 


getAlleleFormat <- function(genoVec,sampleCols){ 
  x <- genoVec
  xmod <- as.character(x)
  names(xmod) <- names(x)
  Ref <- as.character(x["REF"])
  Alt <- as.character(x["ALT"]) 
  xmod0 <- as.character(xmod[sampleCols])
  xmod0[xmod0=="0"] <- paste(Ref,Ref,sep="") 
  xmod0[xmod0=="2"] <- paste(Alt,Alt,sep="") 
  xmod0[xmod0=="1"] <- paste(Ref,Alt,sep="")
  
  xmod[sampleCols]<- xmod0 
  return(xmod)
}


### DSO
genoTable_DF_DSO <- gt2d_DSO_Algnd_Geno_DF
sampleCols_DSO <- grep("^24",colnames(genoTable_DF_DSO),value=T)
genoTable_DF_AF_DSO <- t(apply(genoTable_DF_DSO,1,function(x){getAlleleFormat(x,sampleCols_DSO)}))

### AGP
genoTable_DF_AGP <- gt2d_AGP_Algnd_Geno_DF
sampleCols_AGP <- grep("^24",colnames(genoTable_DF_AGP),value=T)
AGP_GenoTable_DF_AF_V0 <- t(apply(genoTable_DF_AGP,1,function(x){getAlleleFormat(x,sampleCols_AGP)}))

###
DSO_genoTable_DF_AF <- t(genoTable_DF_AF_DSO[,sampleCols_DSO])
colnames(DSO_genoTable_DF_AF) <- genoTable_DF_AF_DSO[,"SNPID"]
###
AGP_genoTable_DF_AF <- t(AGP_GenoTable_DF_AF_V0[,sampleCols_AGP])
colnames(AGP_genoTable_DF_AF) <- AGP_GenoTable_DF_AF_V0[,"SNPID"]

###################################################################################
#### Dudi.pca/sclass plots /dapc 
library(adegenet)
library(ade4)


DSO_GenoTable_GInd <- df2genind(DSO_genoTable_DF_AF,pop=NULL,sep="")	
DSO_Clusters <- find.clusters(DSO_GenoTable_GInd) 
nPCs <- 100
nClusters <- 12

scaledGInd_DSO <- scaleGen(DSO_GenoTable_GInd,scale=FALSE)

pca.GInd.DSO <- dudi.pca(scaledGInd_DSO,center=TRUE,scale=TRUE,scannf=FALSE)
s.class(pca.GInd.DSO$li, fac=DSO_Clusters$grp,col=funky(20),addaxes=TRUE)

####


DSO_dapc <- dapc(DSO_GenoTable_GInd, pop=DSO_Clusters$grp, n.pca=NULL, n.da=NULL, scale=FALSE,
             truenames=TRUE, var.contrib=TRUE, var.loadings=FALSE, pca.info=TRUE,
             pca.select="nbEig", perc.pca=NULL)
			 
scatter.dapc(DSO_dapc,grp=DSO_Clusters$grp)

#####

AGP_GenoTable_GInd <- df2genind(AGP_genoTable_DF_AF,pop=NULL,sep="")	
AGP_Clusters <- find.clusters(AGP_GenoTable_GInd) 
nPCs <- 100
nClusters <- 14

AGP_Clusters2 <- find.clusters(AGP_GenoTable_GInd) 
nPCs <- 100
nClusters <- 14



AGP_dapc <- dapc(AGP_GenoTable_GInd, pop=AGP_Clusters$grp, n.pca=NULL, n.da=NULL, scale=FALSE,
             truenames=TRUE, var.contrib=TRUE, var.loadings=FALSE, pca.info=TRUE,
             pca.select="nbEig", perc.pca=NULL)
			 
scatter.dapc(AGP_dapc,grp=AGP_Clusters$grp)

### 
scaledGInd_AGP <- scaleGen(AGP_GenoTable_GInd,scale=FALSE)
pca.GInd.AGP <- dudi.pca(scaledGInd_AGP,center=TRUE,scale=TRUE,scannf=FALSE)

pca.GInd.AGP
s.class(pca.GInd.AGP$li, fac=AGP_Clusters$grp,col=funky(20),addaxes=TRUE)


#####

##### TangleGram all markers 

DSO_Algnd_DF <- gt2d_DSO_Algnd_Geno_DF[,-c(1:5)]
AGP_Algnd_DF <- gt2d_AGP_Algnd_Geno_DF[,-c(1:5)]

dim(DSO_Algnd_DF)
[1] 2153  317
dim(AGP_Algnd_DF)
[1] 1024  316

#Geno_dendlist <- dendlist() 

##
d_DSO_DF <- dist(t(DSO_Algnd_DF))
hc_DSO <- hclust(d_DSO_DF, method = "ward.D2")  

##
d_AGP_DF <- dist(t(AGP_Algnd_DF))
hc_AGP <- hclust(d_AGP_DF, method = "ward.D2")  


# hc_AGP

# Call:
# hclust(d = d_AGP_DF, method = "ward.D2")

# Cluster method   : ward.D2 
# Distance         : euclidean 
# Number of objects: 316 

# hc_DSO

# Call:
# hclust(d = d_DSO_DF, method = "ward.D2")

# Cluster method   : ward.D2 
# Distance         : euclidean 
# Number of objects: 317

#Geno_dendlist <- dendlist(Geno_dendlist, as.dendrogram(hc_DSO))
#Geno_dendlist <- dendlist(Geno_dendlist, )

library(dendextend)

Geno_dendlist <- dendlist(as.dendrogram(hc_DSO),as.dendrogram(hc_AGP))
names(Geno_dendlist) <- c("DSO","AGP")

Geno_dendlist %>% ladderize %>% set("rank_branches") %>% tanglegram(common_subtrees_color_branches=TRUE)

# Visualize with ladderization and branch ranking
Geno_dendlist %>%
  ladderize %>%                           # Optional: makes plot prettier
  set("branches_k_color", k = 11) %>%     # Optional: color branches by cluster
  set("rank_branches") %>%               # Reorders based on height
  tanglegram(common_subtrees_color_branches = TRUE,
             highlight_distinct_edges = TRUE,
             margin_inner = 7,
             main_left = "DSO Tree",
             main_right = "AGP Tree")



##
d_DSO_DF_CM <- dist(t(DSO_Algnd_DF_CM_Filt))
hc_DSO_CM <- hclust(d_DSO_DF_CM, method = "ward.D2")  

##
d_AGP_DF_CM <- dist(t(AGP_Algnd_DF_CM_Filt))
hc_AGP_CM <- hclust(d_AGP_DF_CM, method = "ward.D2")  






# hc_AGP

# Call:
hclust(d = d_AGP_DF_CM, method = "ward.D2")

Cluster method   : ward.D2 
Distance         : euclidean 
Number of objects: 316 

# > hc_DSO

# Call:
# hclust(d = d_DSO_DF_CM, method = "ward.D2")

# Cluster method   : ward.D2 
# Distance         : euclidean 
# Number of objects: 317 


library(dendextend)

Geno_dendlist_CM <- dendlist(as.dendrogram(hc_DSO_CM),as.dendrogram(hc_AGP_CM))
names(Geno_dendlist_CM) <- c("DSO","AGP")

#Geno_dendlist %>% ladderize %>% set("rank_branches") %>% tanglegram(common_subtrees_color_branches=TRUE)

# Visualize with ladderization and branch ranking
Geno_dendlist_CM %>%
  ladderize %>%                           # Optional: makes plot prettier
  set("branches_k_color", k = 11) %>%     # Optional: color branches by cluster
  set("rank_branches") %>%               # Reorders based on height
  tanglegram(common_subtrees_color_branches = TRUE,
             highlight_distinct_edges = TRUE,
             margin_inner = 7,
             main_left = "DSO Tree",
             main_right = "AGP Tree")


# intersect_trees(Geno_dendlist_CM$DSO,Geno_dendlist_CM$AGP,warn = TRUE)
# [[1]]
# 'dendrogram' with 2 branches and 281 members total, at height 149.8957 

# [[2]]
# 'dendrogram' with 2 branches and 281 members total, at height 166.4871 

# attr(,"class")
# [1] "dendlist" 


