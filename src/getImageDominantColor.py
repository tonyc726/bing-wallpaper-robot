from __future__ import print_function
# https://stackoverflow.com/questions/3241929/python-find-dominant-most-common-color-in-an-image
import binascii
import numpy as np
import scipy
import scipy.misc
import scipy.cluster


def findDominantMostCommonColorInAnImageFile(image):
    NUM_CLUSTERS = 5
    ar = np.asarray(image)
    shape = ar.shape
    ar = ar.reshape(scipy.product(shape[:2]), shape[2]).astype(float)
    # print('finding clusters')
    codes, dist = scipy.cluster.vq.kmeans(ar, NUM_CLUSTERS)
    # print('cluster centres:\n', codes)
    vecs, dist = scipy.cluster.vq.vq(ar, codes)         # assign codes
    counts, bins = scipy.histogram(vecs, len(codes))    # count occurrences
    index_max = scipy.argmax(counts)                    # find most frequent
    peak = codes[index_max]
    colour = binascii.hexlify(bytearray(int(c) for c in peak)).decode('ascii')
    return colour
